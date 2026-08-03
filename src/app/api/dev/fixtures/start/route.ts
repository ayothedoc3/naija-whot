import { ZodError } from "zod";
import { errorJson, okJson } from "@/lib/api-response";
import { buildFixtureGameState } from "@/lib/game-engine/fixtures";
import { toPublicGameState } from "@/lib/game-engine/public-state";
import type { RuleConfig } from "@/lib/game-engine/rules";
import { captureException, logEvent } from "@/lib/logger";
import { getServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import type { Json } from "@/lib/supabase/database.types";
import { devFixtureStartSchema } from "@/lib/validation/dev-fixture";

export const dynamic = "force-dynamic";

/**
 * Deals a specific, deterministic hand/top-card/market arrangement instead
 * of the normal random shuffle — the only way automated tests can reliably
 * exercise a named scenario (a particular special card, a Last Card/Check
 * Up boundary, ...) instead of hoping a random deal produces one. See
 * docs/ARCHITECTURE.md § Development fixture mode.
 *
 * Hard-gated here on the server by reading process.env directly — never on
 * anything the client sends. NOT gated on NODE_ENV: Next.js always sets
 * NODE_ENV=production for any optimized build, including a local
 * `next build && next start` used to run this exact route against a
 * production-parity server for Playwright's own E2E suite — an
 * NODE_ENV check would make this route unreachable in every built
 * environment, not just a real deployment. The actual safety boundary is
 * that a real production deployment's environment variables must simply
 * never set NEXT_PUBLIC_ENABLE_DEV_FIXTURES=true (see .env.example and
 * docs/DEPLOYMENT.md). Everything upstream of this route (creating the
 * room, joining, becoming ready) is the real, unmocked flow; this route
 * only replaces the *dealing* step a real "Start Game" click would trigger.
 */
export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_FIXTURES !== "true") {
    return errorJson("VALIDATION_ERROR", "Not found.", 404);
  }

  const supabase = await getServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return errorJson("UNAUTHENTICATED", "Sign in first.");
  }
  const userId = userData.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson("VALIDATION_ERROR", "Request body must be JSON.");
  }

  let input;
  try {
    input = devFixtureStartSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return errorJson("VALIDATION_ERROR", err.issues[0]?.message ?? "Invalid fixture request.");
    }
    throw err;
  }

  const service = getServiceRoleClient();
  const { data: room, error: roomError } = await service
    .from("rooms")
    .select("id, status, host_user_id, settings")
    .eq("code", input.roomCode.toUpperCase())
    .maybeSingle();

  if (roomError || !room) {
    return errorJson("ROOM_NOT_FOUND", "No room found with that code.");
  }
  if (room.host_user_id !== userId) {
    return errorJson("NOT_ROOM_HOST", "Only the host can start the game.");
  }
  if (room.status !== "lobby") {
    return errorJson("ROOM_GAME_IN_PROGRESS", "This room's game has already started.");
  }

  const { data: members, error: membersError } = await service
    .from("room_members")
    .select("user_id, seat_number")
    .eq("room_id", room.id)
    .order("seat_number", { ascending: true });

  if (membersError || !members || members.length < 2) {
    return errorJson("NOT_ENOUGH_PLAYERS", "At least two players are required to start.");
  }

  const gameId = crypto.randomUUID();
  const ruleConfig = {
    ...(room.settings as unknown as RuleConfig),
    ...input.ruleOverrides,
  } as RuleConfig;

  let state;
  try {
    state = buildFixtureGameState({
      gameId,
      seatUserIds: members.map((m) => m.user_id),
      hands: input.hands,
      topCardId: input.topCardId,
      currentPlayerUserId: input.currentPlayerUserId,
      activeShape: input.activeShape,
      marketCardIds: input.marketCardIds,
      discardHistoryIds: input.discardHistoryIds,
      rules: ruleConfig,
    });
  } catch (err) {
    return errorJson("VALIDATION_ERROR", err instanceof Error ? err.message : "Invalid fixture.");
  }

  const publicState = toPublicGameState(state);
  const { data: createdGameId, error: createErr } = await service.rpc("create_game", {
    p_game_id: gameId,
    p_room_id: room.id,
    p_public_state: publicState as unknown as Json,
    p_canonical_state: state as unknown as Json,
  });

  if (createErr || !createdGameId) {
    captureException(createErr, { route: "POST /api/dev/fixtures/start" });
    return errorJson("INTERNAL_ERROR", "Could not start the fixture game.");
  }

  logEvent({
    event: "game_started",
    gameId: createdGameId,
    roomId: room.id,
    playerCount: members.length,
  });

  return okJson({ gameId: createdGameId });
}
