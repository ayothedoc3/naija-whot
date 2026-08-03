import { describe, expect, it } from "vitest";
import { act, actOrThrow, craftInProgressState } from "./helpers";

describe("forfeit", () => {
  it("marks a non-current player forfeited without changing whose turn it is", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b", "c"],
      hands: { a: ["circle-3"], b: ["circle-4"], c: ["circle-2"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
    });
    const next = actOrThrow(state, "c", { type: "forfeit" });
    expect(next.players.find((p) => p.userId === "c")?.forfeited).toBe(true);
    expect(next.currentPlayerIndex).toBe(0);
  });

  it("passes the turn and clears any pending penalty when the current player forfeits", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b", "c"],
      hands: { a: ["circle-3"], b: ["circle-4"], c: ["circle-2"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      pendingPenalty: { type: "pickTwo", amount: 2, defendingNumber: 2 },
    });
    const next = actOrThrow(state, "a", { type: "forfeit" });
    expect(next.players.find((p) => p.userId === "a")?.forfeited).toBe(true);
    expect(next.pendingPenalty).toBeNull();
    expect(next.players[next.currentPlayerIndex]?.userId).toBe("b");
  });

  it("declares the sole remaining player the round and match winner", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      rules: { bestOf: 5 },
    });
    const next = actOrThrow(state, "a", { type: "forfeit" });
    expect(next.status).toBe("match_over");
    expect(next.roundWinnerUserId).toBe("b");
    expect(next.matchWinnerUserId).toBe("b");
  });

  it("cannot forfeit twice", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b", "c"],
      hands: { a: ["circle-3"], b: ["circle-4"], c: ["circle-2"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      playerOverrides: { c: { forfeited: true } },
    });
    const result = act(state, "c", { type: "forfeit" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("PLAYER_ALREADY_FORFEITED");
  });
});

describe("leaving the game", () => {
  it("is rejected while a round is in progress", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
    });
    const result = act(state, "b", { type: "leave_game" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("CANNOT_LEAVE_DURING_ROUND");
  });

  it("is allowed between rounds and marks the player as no longer in the match", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: {},
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      status: "round_over",
    });
    const next = actOrThrow(state, "b", { type: "leave_game" });
    expect(next.players.find((p) => p.userId === "b")?.forfeited).toBe(true);
  });
});
