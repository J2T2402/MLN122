import { PublicQuestion } from "../shared/socket/events";

/**
 * Per-player option shuffling (anti-cheat #27).
 *
 * The order in which options / statements / drag items / buckets are shown is randomised
 * PER PLAYER so that "copy the neighbour's screen" and "memorise that the answer is B" no
 * longer work. Grading is entirely id-based (see scoring/grade.ts) so re-ordering the display
 * arrays never affects correctness or the reveal statistics.
 *
 * The shuffle is DETERMINISTIC in (playerId, questionId): the same player always sees the same
 * order for a given question, so re-sends (reconnect / STATION_OPEN restore) don't reshuffle
 * under their feet.
 */

// FNV-1a hash -> 32-bit seed
function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Deterministic Fisher–Yates using a small LCG PRNG seeded from the hash.
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  let s = seed >>> 0;
  const rng = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

/**
 * Returns a copy of the public question with its display arrays reordered for this specific
 * player. Ids/text stay paired; only positions change.
 */
export function shuffleQuestionForPlayer(publicQ: PublicQuestion, playerId: string): PublicQuestion {
  const base = hashSeed(playerId + "|" + publicQ.questionId);
  return {
    ...publicQ,
    // Distinct seed offsets per array so orders aren't correlated across the four collections.
    options: publicQ.options ? seededShuffle(publicQ.options, base) : undefined,
    statements: publicQ.statements ? seededShuffle(publicQ.statements, base ^ 0x9e3779b9) : undefined,
    items: publicQ.items ? seededShuffle(publicQ.items, base ^ 0x85ebca6b) : undefined,
    buckets: publicQ.buckets ? seededShuffle(publicQ.buckets, base ^ 0xc2b2ae35) : undefined,
  };
}
