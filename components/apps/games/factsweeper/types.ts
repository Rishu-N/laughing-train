/**
 * Fact-sweeper — shared types and difficulty table.
 *
 * The game is Minesweeper wearing a disk-recovery costume: the grid is a
 * corrupted volume, mines are corrupted sectors, and every safe cell you clear
 * recovers one fact from `content/facts.ts`.
 */
import type { FactRarity } from '@/content/types';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface DifficultyConfig {
  id: Difficulty;
  /** Toolbar label. */
  label: string;
  /** In-fiction name used in the status bar. */
  volume: string;
  rows: number;
  cols: number;
  mines: number;
  /**
   * Which fact rarities this board can surface. This is the whole reason to
   * play a harder disk: `rare` facts exist only on the 16x30.
   */
  rarities: FactRarity[];
  /** Cell edge in CSS px. Smaller boards get chunkier cells. */
  cell: number;
}

export const DIFFICULTIES: DifficultyConfig[] = [
  {
    id: 'easy',
    label: 'Easy',
    volume: 'FLOPPY',
    rows: 9,
    cols: 9,
    mines: 10,
    rarities: ['common'],
    cell: 24,
  },
  {
    id: 'medium',
    label: 'Medium',
    volume: 'HD20',
    rows: 16,
    cols: 16,
    mines: 40,
    rarities: ['common', 'uncommon'],
    cell: 21,
  },
  {
    id: 'hard',
    label: 'Hard',
    volume: 'ARCHIVE',
    rows: 16,
    cols: 30,
    mines: 99,
    rarities: ['common', 'uncommon', 'rare'],
    cell: 20,
  },
];

export function configFor(id: Difficulty): DifficultyConfig {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[0];
}

/** Shape stored under the `factsweeper` session key. */
export interface FactSweeperSession {
  /**
   * Fact IDs only — never whole Fact objects. The owner will rewrite the text
   * in content/facts.ts and a stored copy would go stale and start lying.
   */
  recovered: string[];
  /** Best clear time in seconds per difficulty. */
  best: Record<Difficulty, number | null>;
}

export const EMPTY_SESSION: FactSweeperSession = {
  recovered: [],
  best: { easy: null, medium: null, hard: null },
};

/** Guards against a hand-edited or older payload in localStorage. */
export function normalizeSession(raw: FactSweeperSession): FactSweeperSession {
  const recovered = Array.isArray(raw?.recovered)
    ? raw.recovered.filter((id): id is string => typeof id === 'string')
    : [];
  const best = raw?.best ?? EMPTY_SESSION.best;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    recovered,
    best: {
      easy: num(best.easy),
      medium: num(best.medium),
      hard: num(best.hard),
    },
  };
}
