import { describe, expect, it } from "vitest";
import { act, craftInProgressState } from "./helpers";

describe("empty market reshuffle", () => {
  it("preserves the top card and reshuffles older discard cards into a fresh market", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4"] },
      topCardId: "star-7",
      currentPlayerUserId: "a",
      marketCardIds: [],
      discardHistoryIds: ["circle-1", "circle-2"],
    });

    const result = act(state, "a", { type: "draw_card" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.discardPile).toHaveLength(1);
    expect(result.state.discardPile[0]?.id).toBe("star-7");
    expect(result.events.some((e) => e.type === "market_reshuffled")).toBe(true);
    // 2 cards reshuffled in, 1 drawn -> 1 left in the market.
    expect(result.state.market).toHaveLength(1);
  });

  it("never touches cards already in a player's hand", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4", "triangle-4"] },
      topCardId: "star-7",
      currentPlayerUserId: "a",
      marketCardIds: [],
      discardHistoryIds: ["circle-1", "circle-2", "circle-8"],
    });
    const result = act(state, "a", { type: "draw_card" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const bHand = result.state.players
      .find((p) => p.userId === "b")
      ?.hand.map((c) => c.id)
      .sort();
    expect(bHand).toEqual(["circle-4", "triangle-4"]);
  });

  it("degrades gracefully instead of crashing when no cards remain anywhere", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4"] },
      topCardId: "star-7",
      currentPlayerUserId: "a",
      marketCardIds: [],
      discardHistoryIds: [],
      pendingPenalty: { type: "pickTwo", amount: 2, defendingNumber: 2 },
    });
    const result = act(state, "a", { type: "accept_penalty" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players.find((p) => p.userId === "a")?.hand).toHaveLength(1); // unchanged, nothing to draw
    expect(result.state.pendingPenalty).toBeNull();
  });
});
