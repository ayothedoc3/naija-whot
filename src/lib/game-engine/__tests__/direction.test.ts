import { describe, expect, it } from "vitest";
import { act, actOrThrow, craftInProgressState } from "./helpers";

describe("direction change", () => {
  it("reverses turn order in a 3+ player game when enabled", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b", "c"],
      hands: { a: ["circle-2"], b: ["circle-3"], c: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      rules: { directionChangeOnPenalty: true },
    });
    const next = actOrThrow(state, "a", {
      type: "play_card",
      cardId: "circle-2",
      reverseDirection: true,
    });
    expect(next.direction).toBe(-1);
    // Without reversal, turn would pass to b (seat 1); reversed, it wraps to c (seat 2).
    expect(next.players[next.currentPlayerIndex]?.userId).toBe("c");
  });

  it("does not corrupt state in a 2-player game (no practical effect on who's next)", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-2"], b: ["circle-3"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      rules: { directionChangeOnPenalty: true },
    });
    const next = actOrThrow(state, "a", {
      type: "play_card",
      cardId: "circle-2",
      reverseDirection: true,
    });
    expect(next.direction).toBe(-1);
    expect(next.players[next.currentPlayerIndex]?.userId).toBe("b");
  });

  it("is rejected when the rule is disabled", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-2"], b: ["circle-3"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      rules: { directionChangeOnPenalty: false },
    });
    const result = act(state, "a", {
      type: "play_card",
      cardId: "circle-2",
      reverseDirection: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("RULE_DISABLED");
  });

  it("is rejected on a card that is not a 2 or 5", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      rules: { directionChangeOnPenalty: true },
    });
    const result = act(state, "a", {
      type: "play_card",
      cardId: "circle-3",
      reverseDirection: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("RULE_DISABLED");
  });

  it("is off by default", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-2"], b: ["circle-3"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
    });
    const result = act(state, "a", {
      type: "play_card",
      cardId: "circle-2",
      reverseDirection: true,
    });
    expect(result.ok).toBe(false);
  });
});
