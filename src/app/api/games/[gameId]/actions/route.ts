import { ZodError } from "zod";
import { errorJson, okJson } from "@/lib/api-response";
import { applyAction } from "@/lib/game-engine/reducer";
import { getPrivateHand, toPublicGameState } from "@/lib/game-engine/public-state";
import type { GameState } from "@/lib/game-engine/types";
import type { Json } from "@/lib/supabase/database.types";
import { captureException, logEvent } from "@/lib/logger";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { gameActionSchema } from "@/lib/validation/game-action";

export const dynamic = "force-dynamic";

/**
 * Single entry point for every authoritative game action. The pure engine
 * (src/lib/game-engine/reducer.ts) decides whether the action is legal; this
 * handler's job is authentication, membership, rate limiting, and atomic
 * persistence via commit_game_transition — it never encodes rule logic
 * itself.
 */
export async function POST(request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;

  const supabase = await getServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return errorJson("UNAUTHENTICATED", "Sign in before acting.");
  }
  const userId = userData.user.id;

  const rateLimit = checkRateLimit({ key: `game-action:${userId}`, ...RATE_LIMITS.gameAction });
  if (!rateLimit.allowed) {
    return errorJson("RATE_LIMITED", "Slow down a little.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson("VALIDATION_ERROR", "Request body must be JSON.");
  }

  let action;
  try {
    action = gameActionSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return errorJson("VALIDATION_ERROR", err.issues[0]?.message ?? "Invalid action.");
    }
    throw err;
  }

  const service = getServiceRoleClient();

  const { data: game, error: gameError } = await service
    .from("games")
    .select("id, room_id")
    .eq("id", gameId)
    .maybeSingle();
  if (gameError || !game) {
    return errorJson("ROOM_NOT_FOUND", "Game not found.");
  }

  const { data: membership } = await service
    .from("room_members")
    .select("user_id")
    .eq("room_id", game.room_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) {
    return errorJson("NOT_ROOM_MEMBER", "You are not a member of this game's room.");
  }

  const { data: secretRow, error: secretError } = await service
    .from("game_secret_states")
    .select("canonical_state")
    .eq("game_id", gameId)
    .maybeSingle();
  if (secretError || !secretRow) {
    captureException(secretError, { route: "POST /api/games/[gameId]/actions", gameId });
    return errorJson("INTERNAL_ERROR", "Could not load game state.");
  }

  const canonicalState = secretRow.canonical_state as unknown as GameState;

  const result = applyAction(canonicalState, action, { actingUserId: userId, now: Date.now() });

  if (!result.ok) {
    logEvent({
      event: "action_rejected",
      gameId,
      actionType: action.type,
      actorUserId: userId,
      errorCode: result.error.code,
    });
    return errorJson(result.error.code, result.error.message);
  }

  const publicState = toPublicGameState(result.state);

  const { data: newVersion, error: commitError } = await service.rpc("commit_game_transition", {
    p_game_id: gameId,
    p_expected_version: action.expectedVersion,
    p_new_state_version: result.state.stateVersion,
    p_new_canonical_state: result.state as unknown as Json,
    p_new_public_state: publicState as unknown as Json,
    p_action_id: action.actionId,
    p_actor_user_id: userId,
    p_events: result.events as unknown as Json,
  });

  if (commitError) {
    if (commitError.message === "VERSION_CONFLICT") {
      logEvent({
        event: "version_conflict",
        gameId,
        actorUserId: userId,
        expectedVersion: action.expectedVersion,
        actualVersion: canonicalState.stateVersion,
      });
      return errorJson("VERSION_CONFLICT", "Game state changed — refreshing.");
    }
    if (commitError.message === "DUPLICATE_ACTION") {
      return errorJson("DUPLICATE_ACTION", "This action was already processed.");
    }
    captureException(commitError, {
      route: "POST /api/games/[gameId]/actions",
      gameId,
      actionType: action.type,
    });
    return errorJson("INTERNAL_ERROR", "Could not save the result. Please try again.");
  }

  logEvent({
    event: "action_accepted",
    gameId,
    actionType: action.type,
    actorUserId: userId,
    resultingVersion: newVersion ?? result.state.stateVersion,
  });

  return okJson({
    publicState,
    hand: getPrivateHand(result.state, userId),
    events: result.events,
  });
}
