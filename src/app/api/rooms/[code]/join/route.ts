import { ZodError } from "zod";
import { errorJson, okJson } from "@/lib/api-response";
import { captureException, logEvent } from "@/lib/logger";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { joinRoomSchema } from "@/lib/validation/room";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const supabase = await getServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return errorJson("UNAUTHENTICATED", "Sign in before joining a room.");
  }
  const userId = userData.user.id;

  const rateLimit = checkRateLimit({ key: `join-room:${userId}`, ...RATE_LIMITS.joinRoom });
  if (!rateLimit.allowed) {
    return errorJson("RATE_LIMITED", "Too many join attempts. Try again shortly.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson("VALIDATION_ERROR", "Request body must be JSON.");
  }

  let input;
  try {
    input = joinRoomSchema.parse({ ...(typeof body === "object" && body ? body : {}), code });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorJson("VALIDATION_ERROR", err.issues[0]?.message ?? "Invalid request.");
    }
    throw err;
  }

  const service = getServiceRoleClient();
  const { data, error } = await service
    .rpc("join_room", {
      p_code: input.code,
      p_user_id: userId,
      p_display_name: input.nickname,
    })
    .single();

  if (error) {
    switch (error.message) {
      case "ROOM_NOT_FOUND":
        return errorJson("ROOM_NOT_FOUND", "No room found with that code.");
      case "ROOM_EXPIRED":
        return errorJson("ROOM_EXPIRED", "This room has expired.");
      case "ROOM_FULL":
        return errorJson("ROOM_FULL", "This room is already full.");
      case "GAME_ALREADY_STARTED":
        return errorJson(
          "ROOM_GAME_IN_PROGRESS",
          "This room's game has already started and you weren't already seated.",
        );
      default:
        captureException(error, { route: "POST /api/rooms/[code]/join" });
        return errorJson("INTERNAL_ERROR", "Could not join the room. Please try again.");
    }
  }

  if (!data) {
    return errorJson("INTERNAL_ERROR", "Could not join the room. Please try again.");
  }

  logEvent({ event: "player_joined", roomId: data.room_id, userId, seatNumber: data.seat_number });

  return okJson({
    roomId: data.room_id,
    code: input.code,
    seatNumber: data.seat_number,
    maxPlayers: data.max_players,
    settings: data.settings,
  });
}
