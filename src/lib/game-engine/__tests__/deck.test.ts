import { describe, expect, it } from "vitest";
import { buildStandardDeck, STANDARD_DECK_SIZE } from "../cards";
import { createSeededShuffle, secureShuffle } from "../deck";

describe("deck composition", () => {
  it("contains exactly 54 cards", () => {
    expect(buildStandardDeck()).toHaveLength(STANDARD_DECK_SIZE);
    expect(STANDARD_DECK_SIZE).toBe(54);
  });

  it("has every card id unique", () => {
    const deck = buildStandardDeck();
    const ids = new Set(deck.map((c) => c.id));
    expect(ids.size).toBe(deck.length);
  });

  it("has the correct shape/number composition", () => {
    const deck = buildStandardDeck();
    const byShape: Record<string, number[]> = {};
    for (const c of deck) {
      byShape[c.shape] = [...(byShape[c.shape] ?? []), c.number];
    }
    expect(byShape.Circle?.sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14,
    ]);
    expect(byShape.Triangle?.sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14,
    ]);
    expect(byShape.Cross?.sort((a, b) => a - b)).toEqual([1, 2, 3, 5, 7, 10, 11, 13, 14]);
    expect(byShape.Square?.sort((a, b) => a - b)).toEqual([1, 2, 3, 5, 7, 10, 11, 13, 14]);
    expect(byShape.Star?.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 7, 8]);
    expect(byShape.Whot).toEqual([20, 20, 20, 20, 20]);
  });

  it("assigns the correct special effect per number", () => {
    const deck = buildStandardDeck();
    const effectOf = (n: number) => deck.find((c) => c.number === n)?.effect;
    expect(effectOf(1)).toBe("holdOn");
    expect(effectOf(2)).toBe("pickTwo");
    expect(effectOf(5)).toBe("pickThree");
    expect(effectOf(8)).toBe("suspension");
    expect(effectOf(14)).toBe("generalMarket");
    expect(effectOf(20)).toBe("whot");
    expect(effectOf(3)).toBeNull();
  });
});

describe("shuffling", () => {
  it("secureShuffle returns a permutation containing every original card exactly once", () => {
    const deck = buildStandardDeck();
    const shuffled = secureShuffle(deck);
    expect(shuffled).toHaveLength(deck.length);
    expect(new Set(shuffled.map((c) => c.id))).toEqual(new Set(deck.map((c) => c.id)));
  });

  it("secureShuffle does not mutate the input array", () => {
    const deck = buildStandardDeck();
    const copy = [...deck];
    secureShuffle(deck);
    expect(deck).toEqual(copy);
  });

  it("seeded shuffle is reproducible for the same seed", () => {
    const deck = buildStandardDeck();
    const shuffleA = createSeededShuffle(1234);
    const shuffleB = createSeededShuffle(1234);
    const resultA = shuffleA(deck).map((c) => c.id);
    const resultB = shuffleB(deck).map((c) => c.id);
    expect(resultA).toEqual(resultB);
  });

  it("seeded shuffle produces different orders for different seeds", () => {
    const deck = buildStandardDeck();
    const resultA = createSeededShuffle(1)(deck).map((c) => c.id);
    const resultB = createSeededShuffle(2)(deck).map((c) => c.id);
    expect(resultA).not.toEqual(resultB);
  });

  it("seeded shuffle is a true permutation, not a lossy transform", () => {
    const deck = buildStandardDeck();
    const shuffled = createSeededShuffle(99)(deck);
    expect(new Set(shuffled.map((c) => c.id))).toEqual(new Set(deck.map((c) => c.id)));
  });
});
