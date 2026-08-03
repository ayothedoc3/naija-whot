import { describe, expect, it } from "vitest";
import { actOrThrow, act, craftInProgressState } from "./helpers";

describe("legal move validation", () => {
  it("allows a card matching the active shape", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["triangle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
    });
    const next = actOrThrow(state, "a", { type: "play_card", cardId: "circle-3" });
    expect(next.discardPile.at(-1)?.id).toBe("circle-3");
  });

  it("allows a card matching the top card's number", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["star-4"], b: ["triangle-4"] },
      topCardId: "circle-4",
      currentPlayerUserId: "a",
    });
    const next = actOrThrow(state, "a", { type: "play_card", cardId: "star-4" });
    expect(next.discardPile.at(-1)?.id).toBe("star-4");
  });

  it("allows a Whot card on any top card", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["whot-1"], b: ["triangle-4"] },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
    });
    const next = actOrThrow(state, "a", {
      type: "play_card",
      cardId: "whot-1",
      chosenShape: "Star",
    });
    expect(next.activeShape).toBe("Star");
  });

  it("rejects a card with mismatched shape and number", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["star-3"], b: ["triangle-4"] },
      topCardId: "circle-7",
      currentPlayerUserId: "a",
    });
    const result = act(state, "a", { type: "play_card", cardId: "star-3" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("ILLEGAL_CARD");
  });

  it("rejects playing out of turn", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
    });
    const result = act(state, "b", { type: "play_card", cardId: "circle-4" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_YOUR_TURN");
  });

  it("rejects playing a card not in hand", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
    });
    const result = act(state, "a", { type: "play_card", cardId: "star-7" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("CARD_NOT_IN_HAND");
  });

  it("a voluntary draw advances the turn and adds one card", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4"] },
      topCardId: "star-7",
      currentPlayerUserId: "a",
    });
    const next = actOrThrow(state, "a", { type: "draw_card" });
    expect(next.players[0]?.hand).toHaveLength(2);
    expect(next.currentPlayerIndex).toBe(1);
  });
});
