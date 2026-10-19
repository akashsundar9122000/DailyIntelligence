/**
 * A repeatable sequence of numbers from a string, for drawing the same cover
 * for the same story on every visit, on every server. Not Math.random(): src/
 * has no random numbers (check:provenance), and a cover that changed on every
 * load would look like a different story.
 *
 * FNV-1a to hash, mulberry32 to step. Neither is for security; both are
 * small, fast and well spread, which is all a drawing needs.
 */
export function seeded(key: string): () => number {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index++) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  let state = hash >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A number in [min, max), from a seeded sequence. */
export function between(next: () => number, min: number, max: number): number {
  return min + next() * (max - min);
}

/** One of a list, from a seeded sequence. */
export function pick<T>(next: () => number, items: readonly T[]): T {
  return items[Math.floor(next() * items.length) % items.length]!;
}
