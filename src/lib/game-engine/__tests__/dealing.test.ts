import { describe, expect, it } from "vitest";
import { STANDARD_DECK_SIZE } from "../cards";
import { createGameState, applyAction } from "../reducer";
import { createSeededShuffle } from "../deck";
import { DEFAULT_RULE_CONFIG } from "../rules";
import { nextActionId, startTestGame } from "./helpers";

describe("starting a game", () => {
  it("deals the configured hand size to every player", () => {
    const state = startTestGame({ seatUserIds: ["a", "b", "c"], rules: { startingHandSize: 6 } });
    for (const player of state.players) {
      expect(player.hand).toHaveLength(6);
    }
  });

  it("places exactly one non-special card face up as the starting call card", () => {
    const state = startTestGame();
    expect(state.discardPile).toHaveLength(1);
    expect(state.discardPile[0]?.effect).toBeNull();
  });

  it("puts all remaining cards in the market and accounts for all 54 cards", () => {
    const state = startTestGame({ seatUserIds: ["a", "b"], rules: { startingHandSize: 5 } });
    const totalInHands = state.players.reduce((sum, p) => sum + p.hand.length, 0);
    const total = totalInHands + state.discardPile.length + state.market.length;
    expect(total).toBe(STANDARD_DECK_SIZE);

    const allIds = new Set([
      ...state.players.flatMap((p) => p.hand.map((c) => c.id)),
      ...state.discardPile.map((c) => c.id),
      ...state.market.map((c) => c.id),
    ]);
    expect(allIds.size).toBe(STANDARD_DECK_SIZE);
  });

  it("begins with status in_progress, direction 1, and no pending penalty", () => {
    const state = startTestGame();
    expect(state.status).toBe("in_progress");
    expect(state.direction).toBe(1);
    expect(state.pendingPenalty).toBeNull();
  });

  it("selects a first player from among the seated players", () => {
    const state = startTestGame({ seatUserIds: ["a", "b", "c", "d"] });
    expect(["a", "b", "c", "d"]).toContain(state.players[state.currentPlayerIndex]?.userId);
  });

  it("rejects starting with fewer than two players", () => {
    const initial = createGameState({
      gameId: "g",
      seatUserIds: ["solo"],
      ruleConfig: DEFAULT_RULE_CONFIG,
    });
    const result = applyAction(
      initial,
      { type: "start_game", actionId: nextActionId(), expectedVersion: 0 },
      { actingUserId: "solo", now: 1, shuffle: createSeededShuffle(1) },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_ENOUGH_PLAYERS");
  });

  it("sets a turn deadline when a timer is configured, and none when disabled", () => {
    const withTimer = startTestGame({ rules: { turnTimerSeconds: 30 }, now: 5000 });
    expect(withTimer.turnDeadline).toBe(5000 + 30_000);

    const withoutTimer = startTestGame({ rules: { turnTimerSeconds: null } });
    expect(withoutTimer.turnDeadline).toBeNull();
  });
});
