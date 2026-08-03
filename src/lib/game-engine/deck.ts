import { buildStandardDeck, type Card } from "./cards";

export type ShuffleFn = <T>(items: readonly T[]) => T[];

/**
 * Cryptographically secure Fisher-Yates shuffle using the Web Crypto API
 * (available in both the Node.js and Edge runtimes Next.js targets).
 * Uses rejection sampling to avoid modulo bias.
 */
function secureRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  const maxUint32 = 0xffffffff;
  const limit = maxUint32 - (maxUint32 % maxExclusive);
  const buf = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buf);
    value = buf[0] as number;
  } while (value >= limit);
  return value % maxExclusive;
}

function fisherYates<T>(items: readonly T[], randomInt: (maxExclusive: number) => number): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const a = result[i] as T;
    const b = result[j] as T;
    result[i] = b;
    result[j] = a;
  }
  return result;
}

/** Production shuffle: cryptographically secure, not reproducible. */
export const secureShuffle: ShuffleFn = (items) => fisherYates(items, secureRandomInt);

/**
 * Deterministic mulberry32 PRNG seeded from a 32-bit integer. Only ever used
 * in tests and explicit dev-fixture mode — never in a production code path
 * that decides real game outcomes.
 */
export function createSeededShuffle(seed: number): ShuffleFn {
  let state = seed >>> 0 || 1;
  const nextUint32 = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
  const randomInt = (maxExclusive: number): number => nextUint32() % maxExclusive;
  return (items) => fisherYates(items, randomInt);
}

export function buildShuffledDeck(shuffle: ShuffleFn): Card[] {
  return shuffle(buildStandardDeck());
}

export { buildStandardDeck };
export type { Card };
