import { errorJson, okJson } from "@/lib/api-response";
import { applyAction, createGameState } from "@/lib/game-engine/reducer";
import { normalizeRuleConfig } from "@/lib/game-engine/rules";
import { toPublicGameState } from "@/lib/game-engine/public-state";
import { captureException, logEvent } from "@/lib/logger";
import { getServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import type { Json } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const supabase = await getServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return errorJson("UNAUTHENTICATED", "Sign in before starting a game.");
  }
  const userId = userData.user.id;

  const service = getServiceRoleClient();
  const { data: room, error: roomError } = await service
    .from("rooms")
    .select("id, status, host_user_id, settings")
    .eq("code", code.toUpperCase())
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
    .select("user_id, seat_number, ready, is_host")
    .eq("room_id", room.id)
    .order("seat_number", { ascending: true });

  if (membersError || !members) {
    captureException(membersError, { route: "POST /api/rooms/[code]/start" });
    return errorJson("INTERNAL_ERROR", "Could not load players.");
  }
  if (members.length < 2) {
    return errorJson("NOT_ENOUGH_PLAYERS", "At least two players are required to start.");
  }
  const allNonHostReady = members.filter((m) => !m.is_host).every((m) => m.ready);
  if (!allNonHostReady) {
    return errorJson("PLAYERS_NOT_READY", "All non-host players must be ready first.");
  }

  const gameId = crypto.randomUUID();
  const ruleConfig = normalizeRuleConfig(
    room.settings as Parameters<typeof normalizeRuleConfig>[0],
  );
  const initial = createGameState({
    gameId,
    seatUserIds: members.map((m) => m.user_id),
    ruleConfig,
  });

  const result = applyAction(
    initial,
    { type: "start_game", actionId: crypto.randomUUID(), expectedVersion: 0 },
    { actingUserId: userId, now: Date.now() },
  );

  if (!result.ok) {
    captureException(new Error(result.error.message), {
      route: "POST /api/rooms/[code]/start",
      gameId,
    });
    return errorJson(result.error.code, result.error.message);
  }

  const publicState = toPublicGameState(result.state);
  const { data: createdGameId, error: createErr } = await service.rpc("create_game", {
    p_game_id: gameId,
    p_room_id: room.id,
    p_public_state: publicState as unknown as Json,
    p_canonical_state: result.state as unknown as Json,
  });

  if (createErr || !createdGameId) {
    captureException(createErr, { route: "POST /api/rooms/[code]/start" });
    return errorJson("INTERNAL_ERROR", "Could not start the game. Please try again.");
  }

  logEvent({
    event: "game_started",
    gameId: createdGameId,
    roomId: room.id,
    playerCount: members.length,
  });

  return okJson({ gameId: createdGameId });
}
