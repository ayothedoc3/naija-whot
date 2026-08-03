import { ZodError } from "zod";
import { errorJson, okJson } from "@/lib/api-response";
import { DEFAULT_RULE_CONFIG } from "@/lib/game-engine/rules";
import { logEvent, captureException } from "@/lib/logger";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { generateRoomCode } from "@/lib/room-code";
import { getServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { createRoomSchema } from "@/lib/validation/room";

export const dynamic = "force-dynamic";

const MAX_CODE_ATTEMPTS = 8;

export async function POST(request: Request) {
  const supabase = await getServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return errorJson("UNAUTHENTICATED", "Sign in before creating a room.");
  }
  const userId = userData.user.id;

  const rateLimit = checkRateLimit({ key: `create-room:${userId}`, ...RATE_LIMITS.createRoom });
  if (!rateLimit.allowed) {
    return errorJson("RATE_LIMITED", "Too many rooms created recently. Try again in a minute.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson("VALIDATION_ERROR", "Request body must be JSON.");
  }

  let input;
  try {
    input = createRoomSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return errorJson("VALIDATION_ERROR", err.issues[0]?.message ?? "Invalid request.");
    }
    throw err;
  }

  const service = getServiceRoleClient();

  let lastError: string | undefined;
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateRoomCode();
    const { data: roomId, error } = await service.rpc("create_room_with_host", {
      p_code: code,
      p_host_user_id: userId,
      p_display_name: input.nickname,
      p_max_players: input.settings.maxPlayers,
      p_settings: { ...DEFAULT_RULE_CONFIG, ...input.settings },
    });

    if (!error && roomId) {
      logEvent({
        event: "room_created",
        roomId,
        hostUserId: userId,
        maxPlayers: input.settings.maxPlayers,
      });
      return okJson({ roomId, code }, 201);
    }

    // Unique-violation on the room code — vanishingly unlikely with a 31^6
    // keyspace, but retry with a fresh code rather than fail the request.
    if (error?.code === "23505") {
      lastError = error.message;
      continue;
    }

    captureException(error, { route: "POST /api/rooms" });
    return errorJson("INTERNAL_ERROR", "Could not create the room. Please try again.");
  }

  captureException(new Error(lastError ?? "Exhausted room code attempts"), {
    route: "POST /api/rooms",
  });
  return errorJson("INTERNAL_ERROR", "Could not generate a unique room code. Please try again.");
}
