import { describe, expect, it } from "vitest";
import { act, actOrThrow, craftInProgressState } from "./helpers";

describe("multi-card play", () => {
  it("is rejected by default (disabled)", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3", "triangle-3"], b: ["circle-4"] },
      topCardId: "triangle-5",
      currentPlayerUserId: "a",
    });
    const result = act(state, "a", { type: "play_multi", cardIds: ["circle-3", "triangle-3"] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("MULTI_CARD_PLAY_DISABLED");
  });

  it("allows playing several same-number cards in one action when enabled", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3", "triangle-3", "star-7", "star-8"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      rules: { multiCardPlay: true },
    });
    const next = actOrThrow(state, "a", {
      type: "play_multi",
      cardIds: ["circle-3", "triangle-3"],
    });
    expect(next.players.find((p) => p.userId === "a")?.hand).toHaveLength(2);
    expect(next.discardPile).toHaveLength(3);
  });

  it("the final card in the sequence determines the resulting shape", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3", "triangle-3", "star-7", "star-8"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      rules: { multiCardPlay: true },
    });
    const next = actOrThrow(state, "a", {
      type: "play_multi",
      cardIds: ["circle-3", "triangle-3"],
    });
    expect(next.activeShape).toBe("Triangle");
  });

  it("preserves explicit submitted card order on the discard pile", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3", "triangle-3", "cross-3"], b: ["circle-4"] },
      topCardId: "triangle-5",
      currentPlayerUserId: "a",
      rules: { multiCardPlay: true },
    });
    const next = actOrThrow(state, "a", {
      type: "play_multi",
      cardIds: ["triangle-3", "circle-3", "cross-3"],
    });
    expect(next.discardPile.slice(-3).map((card) => card.id)).toEqual([
      "triangle-3",
      "circle-3",
      "cross-3",
    ]);
    expect(next.activeShape).toBe("Cross");
  });

  it("requires the first card to be legal against the current call card", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["star-3", "cross-3"], b: ["circle-4"] },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
      rules: { multiCardPlay: true },
    });
    const result = act(state, "a", { type: "play_multi", cardIds: ["star-3", "cross-3"] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("ILLEGAL_CARD");
  });

  it("rejects additional cards that do not share the first card's number", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3", "triangle-4"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      rules: { multiCardPlay: true },
    });
    const result = act(state, "a", { type: "play_multi", cardIds: ["circle-3", "triangle-4"] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("MULTI_PLAY_NUMBER_MISMATCH");
  });

  it("rejects selecting the same card twice", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      rules: { multiCardPlay: true },
    });
    const result = act(state, "a", { type: "play_multi", cardIds: ["circle-3", "circle-3"] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DUPLICATE_CARD_SELECTED");
  });

  it("compounds Pick Two by the number of 2s played together", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-2", "triangle-2", "square-10", "cross-10"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      rules: { multiCardPlay: true },
    });
    const next = actOrThrow(state, "a", {
      type: "play_multi",
      cardIds: ["circle-2", "triangle-2"],
    });
    expect(next.pendingPenalty).toEqual({ type: "pickTwo", amount: 4, defendingNumber: 2 });
  });

  it("makes 2 + 2 + 2 a Pick Six", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-2", "triangle-2", "star-2", "square-10", "cross-10"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      rules: { multiCardPlay: true },
    });
    const next = actOrThrow(state, "a", {
      type: "play_multi",
      cardIds: ["circle-2", "triangle-2", "star-2"],
    });
    expect(next.pendingPenalty).toEqual({ type: "pickTwo", amount: 6, defendingNumber: 2 });
  });

  it("compounds Pick Three by the number of 5s played together", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-5", "triangle-5", "square-10", "cross-10"], b: ["circle-4"] },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
      rules: { multiCardPlay: true },
    });
    const next = actOrThrow(state, "a", {
      type: "play_multi",
      cardIds: ["circle-5", "triangle-5"],
    });
    expect(next.pendingPenalty).toEqual({ type: "pickThree", amount: 6, defendingNumber: 5 });
  });

  it("makes 5 + 5 a Pick Six", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-5", "triangle-5", "square-10", "cross-10"], b: ["circle-4"] },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
      rules: { multiCardPlay: true },
    });
    const next = actOrThrow(state, "a", {
      type: "play_multi",
      cardIds: ["circle-5", "triangle-5"],
    });
    expect(next.pendingPenalty).toEqual({ type: "pickThree", amount: 6, defendingNumber: 5 });
  });

  it("rejects mixed Pick Two and Pick Three batches", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-2", "circle-5"], b: ["circle-4"] },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
      rules: { multiCardPlay: true },
    });
    const result = act(state, "a", { type: "play_multi", cardIds: ["circle-2", "circle-5"] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("MULTI_PLAY_NUMBER_MISMATCH");
  });

  it("applies Hold On once for a multi-card batch", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-1", "triangle-1", "square-10", "cross-10"], b: ["circle-4"] },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
      rules: { multiCardPlay: true },
    });
    const next = actOrThrow(state, "a", {
      type: "play_multi",
      cardIds: ["circle-1", "triangle-1"],
    });
    expect(next.players[next.currentPlayerIndex]?.userId).toBe("a");
  });

  it("applies Suspension once for a multi-card batch", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b", "c"],
      hands: {
        a: ["circle-8", "star-8", "square-10", "cross-10"],
        b: ["circle-4"],
        c: ["circle-10"],
      },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
      rules: { multiCardPlay: true },
    });
    const next = actOrThrow(state, "a", {
      type: "play_multi",
      cardIds: ["circle-8", "star-8"],
    });
    expect(next.players[next.currentPlayerIndex]?.userId).toBe("c");
  });

  it("applies General Market once for a multi-card batch", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b", "c"],
      hands: {
        a: ["circle-14", "triangle-14", "square-10", "cross-10"],
        b: ["circle-4"],
        c: ["circle-10"],
      },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
      rules: { multiCardPlay: true },
    });
    const next = actOrThrow(state, "a", {
      type: "play_multi",
      cardIds: ["circle-14", "triangle-14"],
    });
    expect(next.players.find((p) => p.userId === "b")?.hand).toHaveLength(2);
    expect(next.players.find((p) => p.userId === "c")?.hand).toHaveLength(2);
    expect(next.players[next.currentPlayerIndex]?.userId).toBe("a");
  });

  it("allows multi-card defence during a pending Pick Two penalty", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-2", "triangle-2", "square-10", "cross-10"], b: ["circle-4"] },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
      pendingPenalty: { type: "pickTwo", amount: 2, defendingNumber: 2 },
      rules: { multiCardPlay: true },
    });
    const next = actOrThrow(state, "a", {
      type: "play_multi",
      cardIds: ["circle-2", "triangle-2"],
    });
    expect(next.pendingPenalty).toEqual({ type: "pickTwo", amount: 6, defendingNumber: 2 });
  });

  it("rejects Pick Three cards during a pending Pick Two penalty", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-5", "triangle-5", "square-10", "cross-10"], b: ["circle-4"] },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
      pendingPenalty: { type: "pickTwo", amount: 2, defendingNumber: 2 },
      rules: { multiCardPlay: true },
    });
    const result = act(state, "a", {
      type: "play_multi",
      cardIds: ["circle-5", "triangle-5"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("MUST_DEFEND_OR_ACCEPT_PENALTY");
  });

  it("rejects Pick Two cards during a pending Pick Three penalty", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-2", "triangle-2", "square-10", "cross-10"], b: ["circle-4"] },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
      pendingPenalty: { type: "pickThree", amount: 3, defendingNumber: 5 },
      rules: { multiCardPlay: true },
    });
    const result = act(state, "a", {
      type: "play_multi",
      cardIds: ["circle-2", "triangle-2"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("MUST_DEFEND_OR_ACCEPT_PENALTY");
  });

  it("forces drawing instead of defending when Pick Two stacking is disabled", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-2", "triangle-2", "square-10", "cross-10"], b: ["circle-4"] },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
      pendingPenalty: { type: "pickTwo", amount: 2, defendingNumber: 2 },
      rules: { multiCardPlay: true, pickTwoStacking: false },
    });
    const result = act(state, "a", {
      type: "play_multi",
      cardIds: ["circle-2", "triangle-2"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("PENALTY_STACKING_DISABLED");
  });

  it("forces drawing instead of defending when Pick Three stacking is disabled", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-5", "triangle-5", "square-10", "cross-10"], b: ["circle-4"] },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
      pendingPenalty: { type: "pickThree", amount: 3, defendingNumber: 5 },
      rules: { multiCardPlay: true, pickThreeStacking: false },
    });
    const result = act(state, "a", {
      type: "play_multi",
      cardIds: ["circle-5", "triangle-5"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("PENALTY_STACKING_DISABLED");
  });

  it("checks Last Card after the entire batch is removed", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3", "triangle-3", "circle-10"], b: ["circle-4"] },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
      rules: { multiCardPlay: true },
    });
    const next = actOrThrow(state, "a", {
      type: "play_multi",
      cardIds: ["circle-3", "triangle-3"],
      declareLastCard: true,
    });
    expect(next.players.find((p) => p.userId === "a")?.hand).toHaveLength(1);
  });

  it("penalizes missing Last Card after a batch", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3", "triangle-3", "circle-10"], b: ["circle-4"] },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
      rules: { multiCardPlay: true },
    });
    const next = actOrThrow(state, "a", {
      type: "play_multi",
      cardIds: ["circle-3", "triangle-3"],
    });
    expect(next.players.find((p) => p.userId === "a")?.hand).toHaveLength(3);
  });

  it("accepts an old client's Check Up flag on a winning batch", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3", "triangle-3"], b: ["circle-4"] },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
      rules: { multiCardPlay: true },
    });
    const next = actOrThrow(state, "a", {
      type: "play_multi",
      cardIds: ["circle-3", "triangle-3"],
      declareCheckUp: true,
    });
    expect(next.status).toBe("match_over");
  });

  it("wins automatically when the entire batch empties the hand", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3", "triangle-3"], b: ["circle-4"] },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
      rules: { multiCardPlay: true },
    });
    const next = actOrThrow(state, "a", {
      type: "play_multi",
      cardIds: ["circle-3", "triangle-3"],
    });
    expect(next.status).toBe("match_over");
    expect(next.roundWinnerUserId).toBe("a");
    expect(next.players.find((p) => p.userId === "a")?.hand).toHaveLength(0);
  });

  it("does not apply either declaration penalty when a batch empties the hand", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3", "triangle-3"], b: ["circle-4"] },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
      rules: { multiCardPlay: true },
    });
    const result = act(state, "a", {
      type: "play_multi",
      cardIds: ["circle-3", "triangle-3"],
      declareLastCard: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = result.state;
    expect(next.status).toBe("match_over");
    expect(next.players.find((p) => p.userId === "a")?.hand).toHaveLength(0);
    expect(result.events.map((event) => event.type)).not.toContain("check_up_penalty");
    expect(result.events.map((event) => event.type)).not.toContain("last_card_penalty");
  });

  it("requires exactly one shape choice for a multi-Whot play", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["whot-1", "whot-2"], b: ["circle-4"] },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
      rules: { multiCardPlay: true },
    });
    const next = actOrThrow(state, "a", {
      type: "play_multi",
      cardIds: ["whot-1", "whot-2"],
      chosenShape: "Square",
    });
    expect(next.activeShape).toBe("Square");
  });
});
