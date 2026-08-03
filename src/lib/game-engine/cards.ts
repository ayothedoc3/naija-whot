/**
 * Nigerian Whot deck definition. Pure data — no I/O, no framework imports.
 */

export const SHAPES = ["Circle", "Triangle", "Cross", "Square", "Star", "Whot"] as const;
export type Shape = (typeof SHAPES)[number];

/** Shapes a player may request after playing a Whot card. Whot itself is never requestable. */
export const REQUESTABLE_SHAPES = ["Circle", "Triangle", "Cross", "Square", "Star"] as const;
export type RequestableShape = (typeof REQUESTABLE_SHAPES)[number];

export type CardEffect =
  "holdOn" | "pickTwo" | "pickThree" | "suspension" | "generalMarket" | "whot";

/** Special effect a number carries, independent of whether the room's rules enable it. */
export const NUMBER_EFFECTS: Partial<Record<number, CardEffect>> = {
  1: "holdOn",
  2: "pickTwo",
  5: "pickThree",
  8: "suspension",
  14: "generalMarket",
  20: "whot",
};

export interface Card {
  /** Unique across the whole 54-card deck. */
  readonly id: string;
  readonly shape: Shape;
  readonly number: number;
  /** What a client should render, e.g. "5" or "Whot". */
  readonly displayValue: string;
  /** Used only for optional end-of-round remaining-card scoring. */
  readonly scoreValue: number;
  readonly effect: CardEffect | null;
}

const NUMBERS_BY_SHAPE: Record<Exclude<Shape, "Whot">, readonly number[]> = {
  Circle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
  Triangle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
  Cross: [1, 2, 3, 5, 7, 10, 11, 13, 14],
  Square: [1, 2, 3, 5, 7, 10, 11, 13, 14],
  Star: [1, 2, 3, 4, 5, 7, 8],
};

const WHOT_CARD_COUNT = 5;
const WHOT_NUMBER = 20;

function makeCard(shape: Shape, number: number, uniqueSuffix?: number): Card {
  return {
    id: shape === "Whot" ? `whot-${uniqueSuffix}` : `${shape.toLowerCase()}-${number}`,
    shape,
    number,
    displayValue: shape === "Whot" ? "Whot" : String(number),
    scoreValue: number,
    effect: NUMBER_EFFECTS[number] ?? null,
  };
}

/**
 * Builds the canonical, unshuffled 54-card Nigerian Whot deck in a fixed,
 * deterministic order. Callers shuffle via `deck.ts`.
 */
export function buildStandardDeck(): Card[] {
  const cards: Card[] = [];

  for (const shape of Object.keys(NUMBERS_BY_SHAPE) as Exclude<Shape, "Whot">[]) {
    for (const number of NUMBERS_BY_SHAPE[shape]) {
      cards.push(makeCard(shape, number));
    }
  }

  for (let i = 1; i <= WHOT_CARD_COUNT; i++) {
    cards.push(makeCard("Whot", WHOT_NUMBER, i));
  }

  return cards;
}

export const STANDARD_DECK_SIZE = 54;

export function isWhotCard(card: Card): boolean {
  return card.shape === "Whot";
}

export function isRequestableShape(shape: string): shape is RequestableShape {
  return (REQUESTABLE_SHAPES as readonly string[]).includes(shape);
}
