import { errorJson, okJson } from "@/lib/api-response";
import { getPrivateHand } from "@/lib/game-engine/public-state";
import type { GameState } from "@/lib/game-engine/types";
import { captureException } from "@/lib/logger";
import { getServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

/**
 * The only place a player's own hand is ever returned to a client. Never
 * derivable from `games.public_state` (which only carries hand counts) —
 * this route reads game_secret_states, which no client role can select
 * directly, and returns only the requesting player's own cards.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;

  const supabase = await getServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return errorJson("UNAUTHENTICATED", "Sign in first.");
  }
  const userId = userData.user.id;

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
    captureException(secretError, { route: "GET /api/games/[gameId]/hand", gameId });
    return errorJson("INTERNAL_ERROR", "Could not load your hand.");
  }

  const canonicalState = secretRow.canonical_state as unknown as GameState;
  return okJson({ hand: getPrivateHand(canonicalState, userId) });
}
