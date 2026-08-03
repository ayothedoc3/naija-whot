/**
 * Deterministic JSON serialization: recursively sorts object keys so the
 * same logical state always produces byte-identical output, regardless of
 * property insertion order. Used for storing/comparing canonical and public
 * state, and verified by a dedicated test.
 */
function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortValue((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function serializeState<T>(state: T): string {
  return stableStringify(state);
}

export function deserializeState<T>(json: string): T {
  return JSON.parse(json) as T;
}
