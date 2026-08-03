import { describe, expect, it } from "vitest";
import { act, actOrThrow, craftInProgressState } from "./helpers";

describe("double decking", () => {
  it("is rejected by default (disabled)", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3", "triangle-3"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
    });
    const result = act(state, "a", { type: "play_multi", cardIds: ["circle-3", "triangle-3"] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DOUBLE_DECKING_DISABLED");
  });

  it("allows playing several same-number cards in one action when enabled", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3", "triangle-3", "star-7", "star-8"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      rules: { doubleDecking: true },
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
      rules: { doubleDecking: true },
    });
    const next = actOrThrow(state, "a", {
      type: "play_multi",
      cardIds: ["circle-3", "triangle-3"],
    });
    expect(next.activeShape).toBe("Triangle");
  });

  it("requires the first card to be legal against the current call card", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["star-3", "cross-3"], b: ["circle-4"] },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
      rules: { doubleDecking: true },
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
      rules: { doubleDecking: true },
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
      rules: { doubleDecking: true },
    });
    const result = act(state, "a", { type: "play_multi", cardIds: ["circle-3", "circle-3"] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DUPLICATE_CARD_SELECTED");
  });

  it("compounds Pick Two by the number of 2s played together", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-2", "triangle-2"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      rules: { doubleDecking: true },
    });
    const next = actOrThrow(state, "a", {
      type: "play_multi",
      cardIds: ["circle-2", "triangle-2"],
    });
    expect(next.pendingPenalty).toEqual({ type: "pickTwo", amount: 4, defendingNumber: 2 });
  });

  it("requires exactly one shape choice for a multi-Whot play", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["whot-1", "whot-2"], b: ["circle-4"] },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
      rules: { doubleDecking: true },
    });
    const next = actOrThrow(state, "a", {
      type: "play_multi",
      cardIds: ["whot-1", "whot-2"],
      chosenShape: "Square",
    });
    expect(next.activeShape).toBe("Square");
  });
});
