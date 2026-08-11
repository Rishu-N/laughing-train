/**
 * Fact-sweeper — the fact layer.
 *
 * This module is the ONLY place the game touches `content/facts.ts`. Nothing in
 * the UI knows what a fact says; it asks for an id and renders whatever the
 * owner wrote. That is what lets the owner rewrite every line in content/ without
 * opening a component.
 *
 * Two rules live here:
 *
 *   1. RARITY GATES DEPTH. Easy draws from `common` only, Medium adds
 *      `uncommon`, Hard unlocks `rare`. The rare facts are the reason to sit
 *      down in front of the 16x30.
 *   2. NO REPEATS UNTIL EXHAUSTED. Draws come from the unrecovered pool first;
 *      only once a player has everything available at that difficulty do facts
 *      start recycling (flagged as repeats so the dossier count stays honest).
 */
import { facts } from '@/content/facts';
import type { Fact, FactCategory, FactRarity } from '@/content/types';
import { configFor, type Difficulty } from './types';

const BY_ID: Map<string, Fact> = new Map(facts.map((f) => [f.id, f]));

/** Every fact the owner has written, in file order. */
export const ALL_FACTS: readonly Fact[] = facts;

/** Returns null for ids that no longer exist — e.g. a fact the owner deleted
 *  after a visitor had already recovered it. */
export function getFact(id: string): Fact | null {
  return BY_ID.get(id) ?? null;
}

/** The facts a given board is allowed to surface. */
export function poolFor(difficulty: Difficulty): Fact[] {
  const allowed = new Set<FactRarity>(configFor(difficulty).rarities);
  return facts.filter((f) => allowed.has(f.rarity));
}

/** How many facts are sealed behind harder disks than this one. */
export function lockedCount(difficulty: Difficulty): number {
  return facts.length - poolFor(difficulty).length;
}

export interface Draw {
  factId: string;
  /** True when this fact was already in the dossier — no progress, just flavour. */
  repeat: boolean;
}

function shuffle<T>(items: T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Pull `count` facts for a batch of freshly cleared cells (one click can open a
 * whole region, so batches are common).
 *
 * `recovered` is the player's persisted dossier. Fresh facts come first, in
 * random order; if the batch is bigger than what's left, the remainder recycles
 * known facts marked `repeat`. Returns [] when the owner has written no facts
 * at this rarity at all, which the caller renders as an empty sector.
 */
export function drawFacts(
  difficulty: Difficulty,
  recovered: ReadonlySet<string>,
  count: number,
): Draw[] {
  if (count <= 0) return [];
  const pool = poolFor(difficulty);
  if (pool.length === 0) return [];

  const draws: Draw[] = [];
  for (const fact of shuffle(pool.filter((f) => !recovered.has(f.id)))) {
    if (draws.length >= count) break;
    draws.push({ factId: fact.id, repeat: false });
  }

  if (draws.length < count) {
    // Every fact at this rarity is now on file — either recovered earlier or
    // pulled a moment ago in this same batch — so the remaining sectors surface
    // duplicates. They read as "DUPLICATE" and move no counters.
    const known = shuffle(pool);
    let i = 0;
    while (draws.length < count && known.length > 0) {
      draws.push({ factId: known[i % known.length].id, repeat: true });
      i += 1;
    }
  }

  return draws;
}

/* ------------------------------------------------------------- display ----- */

/** Dossier section order. Chrome ordering, not content. */
export const CATEGORY_ORDER: FactCategory[] = [
  'basics',
  'work',
  'interests',
  'trivia',
  'opinions',
];

/** Section headings. UI chrome — the facts themselves all come from content/. */
export const CATEGORY_LABELS: Record<FactCategory, string> = {
  basics: 'Basics',
  work: 'Work',
  interests: 'Interests',
  trivia: 'Trivia',
  opinions: 'Opinions',
};

export const RARITY_LABELS: Record<FactRarity, string> = {
  common: 'COMMON',
  uncommon: 'UNCOMMON',
  rare: 'RARE',
};

/** How many facts exist in each category, for the "3 sectors unread" hints. */
export function categoryTotals(): Record<FactCategory, number> {
  const totals: Record<FactCategory, number> = {
    basics: 0,
    work: 0,
    interests: 0,
    trivia: 0,
    opinions: 0,
  };
  for (const fact of facts) totals[fact.category] += 1;
  return totals;
}
