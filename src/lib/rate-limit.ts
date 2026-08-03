import "server-only";

/**
 * Minimal in-memory fixed-window rate limiter. Deliberately single-instance:
 * fine for one Coolify container, and the interface below is small enough
 * to swap for a Postgres- or Redis-backed store (see docs/SECURITY.md) if
 * the app is ever scaled to multiple replicas — no call site would change.
 */
interface Bucket {
  count: number;
  windowStartMs: number;
}

const buckets = new Map<string, Bucket>();

// Bound memory growth: periodically drop buckets whose window has long
// since expired, so this never accumulates one entry per user forever.
const MAX_BUCKETS = 50_000;

export interface RateLimitOptions {
  /** Unique key for this limiter + identity, e.g. `create-room:${userId}`. */
  key: string;
  /** Maximum requests allowed per window. */
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAtMs: number;
}

export function checkRateLimit({ key, limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStartMs >= windowMs) {
    if (buckets.size >= MAX_BUCKETS) {
      pruneExpiredBuckets(now, windowMs);
    }
    buckets.set(key, { count: 1, windowStartMs: now });
    return { allowed: true, remaining: limit - 1, resetAtMs: now + windowMs };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAtMs: existing.windowStartMs + windowMs };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: limit - existing.count,
    resetAtMs: existing.windowStartMs + windowMs,
  };
}

function pruneExpiredBuckets(now: number, windowMs: number) {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStartMs >= windowMs) {
      buckets.delete(key);
    }
  }
}

/** Common presets used across route handlers (see docs/SECURITY.md). */
export const RATE_LIMITS = {
  createRoom: { limit: 5, windowMs: 60_000 },
  joinRoom: { limit: 10, windowMs: 60_000 },
  gameAction: { limit: 60, windowMs: 10_000 },
} as const;
