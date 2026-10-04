import { describe, expect, it } from "vitest";
import { act, actOrThrow, craftInProgressState } from "./helpers";

describe("Hold On (1)", () => {
  it("lets the same player play again when enabled", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-1", "square-10", "cross-10"], b: ["circle-2"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
    });
    const next = actOrThrow(state, "a", { type: "play_card", cardId: "circle-1" });
    expect(next.currentPlayerIndex).toBe(0);
  });

  it("in a two-player game, the same player still plays again", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-1", "square-10", "cross-10"], b: ["circle-2"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
    });
    const next = actOrThrow(state, "a", { type: "play_card", cardId: "circle-1" });
    expect(next.players[next.currentPlayerIndex]?.userId).toBe("a");
  });

  it("acts as a normal card when the rule is disabled", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-1", "square-10", "cross-10"], b: ["circle-2"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      rules: { holdOn: false },
    });
    const next = actOrThrow(state, "a", { type: "play_card", cardId: "circle-1" });
    expect(next.currentPlayerIndex).toBe(1);
  });
});

describe("Suspension (8)", () => {
  it("skips the next active player in a 3+ player game", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b", "c"],
      hands: { a: ["circle-8", "square-10", "cross-10"], b: ["circle-2"], c: ["circle-3"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
    });
    const next = actOrThrow(state, "a", { type: "play_card", cardId: "circle-8" });
    expect(next.players[next.currentPlayerIndex]?.userId).toBe("c");
  });

  it("gives the player who played it another turn in a 2-player game", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-8", "square-10", "cross-10"], b: ["circle-2"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
    });
    const next = actOrThrow(state, "a", { type: "play_card", cardId: "circle-8" });
    expect(next.players[next.currentPlayerIndex]?.userId).toBe("a");
  });
});

describe("General Market (14)", () => {
  it("makes every other active player draw one card and the actor plays again", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b", "c"],
      hands: { a: ["circle-14", "square-10", "cross-10"], b: ["circle-2"], c: ["circle-3"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
    });
    const next = actOrThrow(state, "a", { type: "play_card", cardId: "circle-14" });
    expect(next.players.find((p) => p.userId === "b")?.hand).toHaveLength(2);
    expect(next.players.find((p) => p.userId === "c")?.hand).toHaveLength(2);
    expect(next.players[next.currentPlayerIndex]?.userId).toBe("a");
  });

  it("cannot be defended against", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-14", "square-10", "cross-10"], b: ["circle-2"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
    });
    const next = actOrThrow(state, "a", { type: "play_card", cardId: "circle-14" });
    expect(next.pendingPenalty).toBeNull();
  });
});

describe("Pick Two (2)", () => {
  it("sets a pending penalty of 2 for the next player", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-2", "square-10", "cross-10"], b: ["circle-3"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
    });
    const next = actOrThrow(state, "a", { type: "play_card", cardId: "circle-2" });
    expect(next.pendingPenalty).toEqual({ type: "pickTwo", amount: 2, defendingNumber: 2 });
    expect(next.players[next.currentPlayerIndex]?.userId).toBe("b");
  });

  it("stacks when defended with another 2", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["triangle-2", "square-10", "cross-10"] },
      topCardId: "circle-5",
      currentPlayerUserId: "b",
      pendingPenalty: { type: "pickTwo", amount: 2, defendingNumber: 2 },
    });
    const next = actOrThrow(state, "b", { type: "play_card", cardId: "triangle-2" });
    expect(next.pendingPenalty).toEqual({ type: "pickTwo", amount: 4, defendingNumber: 2 });
  });

  it("a player may choose to accept the penalty instead of defending", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["triangle-2", "square-3"] },
      topCardId: "circle-5",
      currentPlayerUserId: "b",
      pendingPenalty: { type: "pickTwo", amount: 2, defendingNumber: 2 },
    });
    const next = actOrThrow(state, "b", { type: "accept_penalty" });
    expect(next.pendingPenalty).toBeNull();
    expect(next.players.find((p) => p.userId === "b")?.hand.length).toBe(4);
    expect(next.players[next.currentPlayerIndex]?.userId).toBe("a");
  });

  it("still applies the initial Pick Two when stacking is disabled", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-2", "square-10", "cross-10"], b: ["circle-3"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      rules: { pickTwoStacking: false },
    });
    const next = actOrThrow(state, "a", { type: "play_card", cardId: "circle-2" });
    expect(next.pendingPenalty).toEqual({ type: "pickTwo", amount: 2, defendingNumber: 2 });
    expect(next.players[next.currentPlayerIndex]?.userId).toBe("b");
  });
});

describe("Pick Three (5)", () => {
  it("sets a pending penalty of 3 for the next player", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-5", "square-10", "cross-10"], b: ["circle-3"] },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
    });
    const next = actOrThrow(state, "a", { type: "play_card", cardId: "circle-5" });
    expect(next.pendingPenalty).toEqual({ type: "pickThree", amount: 3, defendingNumber: 5 });
  });

  it("stacks when defended with another 5", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["triangle-5", "square-10", "cross-10"] },
      topCardId: "circle-7",
      currentPlayerUserId: "b",
      pendingPenalty: { type: "pickThree", amount: 3, defendingNumber: 5 },
    });
    const next = actOrThrow(state, "b", { type: "play_card", cardId: "triangle-5" });
    expect(next.pendingPenalty).toEqual({ type: "pickThree", amount: 6, defendingNumber: 5 });
  });

  it("still applies the initial Pick Three when stacking is disabled", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-5", "square-10", "cross-10"], b: ["circle-3"] },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
      rules: { pickThreeStacking: false },
    });
    const next = actOrThrow(state, "a", { type: "play_card", cardId: "circle-5" });
    expect(next.pendingPenalty).toEqual({ type: "pickThree", amount: 3, defendingNumber: 5 });
  });
});

describe("penalty mixing is rejected", () => {
  it("cannot defend a Pick Two with a 5", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-5", "square-10", "cross-10"], b: ["circle-3"] },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
      pendingPenalty: { type: "pickTwo", amount: 2, defendingNumber: 2 },
    });
    const result = act(state, "a", { type: "play_card", cardId: "circle-5" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("MUST_DEFEND_OR_ACCEPT_PENALTY");
  });

  it("cannot defend a Pick Three with a 2", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-2", "square-10", "cross-10"], b: ["circle-3"] },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
      pendingPenalty: { type: "pickThree", amount: 3, defendingNumber: 5 },
    });
    const result = act(state, "a", { type: "play_card", cardId: "circle-2" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("MUST_DEFEND_OR_ACCEPT_PENALTY");
  });

  it("cannot voluntarily draw while a penalty is pending", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4"] },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
      pendingPenalty: { type: "pickTwo", amount: 2, defendingNumber: 2 },
    });
    const result = act(state, "a", { type: "draw_card" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("MUST_DEFEND_OR_ACCEPT_PENALTY");
  });

  it("must accept a Pick Two penalty when Pick Two stacking is disabled", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-2", "square-10", "cross-10"], b: ["circle-4"] },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
      pendingPenalty: { type: "pickTwo", amount: 2, defendingNumber: 2 },
      rules: { pickTwoStacking: false },
    });
    const result = act(state, "a", { type: "play_card", cardId: "circle-2" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("PENALTY_STACKING_DISABLED");
  });
});

describe("Whot (20) shape selection", () => {
  it("requires a shape selection", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["whot-1"], b: ["circle-2"] },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
    });
    const result = act(state, "a", { type: "play_card", cardId: "whot-1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("MISSING_SHAPE_SELECTION");
  });

  it("rejects selecting Whot as the requested shape", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["whot-1"], b: ["circle-2"] },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
    });
    const result = act(state, "a", {
      type: "play_card",
      cardId: "whot-1",
      // @ts-expect-error -- simulating an untrusted client bypassing the type system
      chosenShape: "Whot",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_SHAPE_SELECTION");
  });

  it("sets the active shape to the chosen shape and is playable on any top card", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["whot-1"], b: ["circle-2"] },
      topCardId: "cross-7",
      currentPlayerUserId: "a",
    });
    const next = actOrThrow(state, "a", {
      type: "play_card",
      cardId: "whot-1",
      chosenShape: "Star",
    });
    expect(next.activeShape).toBe("Star");
  });
});
