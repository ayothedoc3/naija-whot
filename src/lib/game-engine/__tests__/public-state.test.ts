import { describe, expect, it } from "vitest";
import { getPrivateHand, toPublicGameState } from "../public-state";
import { deserializeState, stableStringify } from "../serialization";
import { craftInProgressState } from "./helpers";

describe("public state sanitization", () => {
  const state = craftInProgressState({
    seatUserIds: ["a", "b"],
    hands: { a: ["circle-3", "circle-10"], b: ["circle-4", "star-2", "whot-1"] },
    topCardId: "circle-5",
    currentPlayerUserId: "a",
  });

  it("never includes any player's hand contents", () => {
    const publicState = toPublicGameState(state);
    const serialized = JSON.stringify(publicState);
    for (const cardId of ["circle-3", "circle-10", "circle-4", "star-2", "whot-1"]) {
      expect(serialized).not.toContain(cardId);
    }
    for (const p of publicState.players) {
      expect(p).not.toHaveProperty("hand");
    }
  });

  it("exposes only hand counts, not hands", () => {
    const publicState = toPublicGameState(state);
    expect(publicState.players.find((p) => p.userId === "a")?.handCount).toBe(2);
    expect(publicState.players.find((p) => p.userId === "b")?.handCount).toBe(3);
  });

  it("exposes only the market count, never the market's card order", () => {
    const publicState = toPublicGameState(state);
    expect(publicState).not.toHaveProperty("market");
    expect(typeof publicState.marketCount).toBe("number");
    expect(publicState.marketCount).toBe(state.market.length);
  });

  it("exposes only the top discard card and a count, not the full pile", () => {
    const publicState = toPublicGameState(state);
    expect(publicState).not.toHaveProperty("discardPile");
    expect(publicState.topCard?.id).toBe("circle-5");
    expect(publicState.discardCount).toBe(1);
  });

  it("getPrivateHand returns the correct cards for the requesting player only", () => {
    expect(
      getPrivateHand(state, "a")
        .map((c) => c.id)
        .sort(),
    ).toEqual(["circle-10", "circle-3"]);
    expect(
      getPrivateHand(state, "b")
        .map((c) => c.id)
        .sort(),
    ).toEqual(["circle-4", "star-2", "whot-1"]);
    expect(getPrivateHand(state, "nobody")).toEqual([]);
  });
});

describe("deterministic serialization", () => {
  it("produces identical output regardless of key insertion order", () => {
    const a = { z: 1, a: 2, nested: { b: 1, a: 2 } };
    const b = { a: 2, nested: { a: 2, b: 1 }, z: 1 };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it("round-trips through JSON without loss", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
    });
    const publicState = toPublicGameState(state);
    const roundTripped = deserializeState<typeof publicState>(stableStringify(publicState));
    expect(roundTripped).toEqual(publicState);
  });

  it("produces the same string for two separately-constructed but equal states", () => {
    const stateA = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
    });
    const stateB = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
    });
    expect(stableStringify(toPublicGameState(stateA))).toBe(
      stableStringify(toPublicGameState(stateB)),
    );
  });
});
