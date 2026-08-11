/**
 * Fact-sweeper — pure board logic. No React, no DOM, no content imports.
 *
 * Everything here takes a board and returns information about it; the app
 * component clones a board, mutates the clone through these helpers, and swaps
 * it into state. Keeping it pure means the tricky parts (first-click safety,
 * flood fill, chording) are testable in isolation.
 */
import type { DifficultyConfig } from './types';

export interface Cell {
  mine: boolean;
  /** Number of mines in the 8 surrounding cells. 0 renders blank. */
  adjacent: number;
  revealed: boolean;
  flagged: boolean;
  /** Fact recovered from this cell, assigned at reveal time. */
  factId: string | null;
  /** True when this cell re-surfaced a fact already in the dossier. */
  factRepeat: boolean;
  /** The one mine the player actually clicked — drawn hotter on the loss board. */
  detonated: boolean;
}

export interface Board {
  rows: number;
  cols: number;
  mineCount: number;
  cells: Cell[];
  /**
   * False until the first click. Mines are placed AFTER that click so the
   * opening move can never lose — the single most important fairness rule in
   * Minesweeper, and the one most clones get wrong.
   */
  seeded: boolean;
}

function emptyCell(): Cell {
  return {
    mine: false,
    adjacent: 0,
    revealed: false,
    flagged: false,
    factId: null,
    factRepeat: false,
    detonated: false,
  };
}

export function createBoard(config: DifficultyConfig): Board {
  const { rows, cols, mines } = config;
  return {
    rows,
    cols,
    mineCount: mines,
    cells: Array.from({ length: rows * cols }, emptyCell),
    seeded: false,
  };
}

export function cloneBoard(board: Board): Board {
  return { ...board, cells: board.cells.map((c) => ({ ...c })) };
}

export function rowOf(board: Board, index: number): number {
  return Math.floor(index / board.cols);
}

export function colOf(board: Board, index: number): number {
  return index % board.cols;
}

/** Indices of the (up to) 8 cells touching `index`. */
export function neighbors(board: Board, index: number): number[] {
  const r = rowOf(board, index);
  const c = colOf(board, index);
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= board.rows || nc < 0 || nc >= board.cols) continue;
      out.push(nr * board.cols + nc);
    }
  }
  return out;
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
 * Place mines, guaranteeing that `safeIndex` and — where the board has room —
 * its whole 3x3 neighbourhood stay clear. Clearing the neighbourhood as well is
 * what makes the first click open a region instead of a lone number.
 */
export function seedBoard(board: Board, safeIndex: number): void {
  const protectedZone = new Set<number>([safeIndex, ...neighbors(board, safeIndex)]);
  const total = board.rows * board.cols;

  let candidates = [];
  for (let i = 0; i < total; i += 1) {
    if (!protectedZone.has(i)) candidates.push(i);
  }
  // Dense boards (or tiny ones) may not have room for the full safe pocket;
  // fall back to protecting only the clicked cell, which is the part that
  // actually matters.
  if (candidates.length < board.mineCount) {
    candidates = [];
    for (let i = 0; i < total; i += 1) {
      if (i !== safeIndex) candidates.push(i);
    }
  }

  for (const i of shuffle(candidates).slice(0, board.mineCount)) {
    board.cells[i].mine = true;
  }

  for (let i = 0; i < total; i += 1) {
    if (board.cells[i].mine) continue;
    board.cells[i].adjacent = neighbors(board, i).reduce(
      (n, j) => n + (board.cells[j].mine ? 1 : 0),
      0,
    );
  }

  board.seeded = true;
}

/**
 * Reveal `index` and flood-fill outwards through blank (adjacent === 0) cells.
 * Returns the newly revealed indices in reveal order — the app hands that list
 * to the fact pool so each opened sector recovers something.
 *
 * Assumes `index` is not a mine; mines are checked by the caller.
 */
export function revealFrom(board: Board, index: number): number[] {
  const opened: number[] = [];
  const queue = [index];

  while (queue.length > 0) {
    const i = queue.shift() as number;
    const cell = board.cells[i];
    if (cell.revealed || cell.flagged || cell.mine) continue;
    cell.revealed = true;
    opened.push(i);
    if (cell.adjacent === 0) {
      for (const n of neighbors(board, i)) {
        const next = board.cells[n];
        if (!next.revealed && !next.flagged && !next.mine) queue.push(n);
      }
    }
  }

  return opened;
}

export interface ChordResult {
  /** Cells that would be opened. Empty when the chord is not available. */
  targets: number[];
  /** True when one of those cells is a mine — the player mis-flagged. */
  hitsMine: boolean;
}

/**
 * Classic chording: clicking a revealed number whose flag count already matches
 * it opens every remaining neighbour. Fast, and unforgiving if you flagged
 * wrong — which is the point.
 */
export function chordAt(board: Board, index: number): ChordResult {
  const cell = board.cells[index];
  if (!cell.revealed || cell.adjacent === 0) return { targets: [], hitsMine: false };

  const ns = neighbors(board, index);
  const flagged = ns.filter((n) => board.cells[n].flagged).length;
  if (flagged !== cell.adjacent) return { targets: [], hitsMine: false };

  const targets = ns.filter((n) => !board.cells[n].revealed && !board.cells[n].flagged);
  return {
    targets,
    hitsMine: targets.some((n) => board.cells[n].mine),
  };
}

export function flagCount(board: Board): number {
  return board.cells.reduce((n, c) => n + (c.flagged ? 1 : 0), 0);
}

export function revealedCount(board: Board): number {
  return board.cells.reduce((n, c) => n + (c.revealed ? 1 : 0), 0);
}

export function safeCellCount(board: Board): number {
  return board.rows * board.cols - board.mineCount;
}

/** Won when every non-mine cell is revealed. Flags are irrelevant. */
export function isWon(board: Board): boolean {
  return board.cells.every((c) => c.mine || c.revealed);
}

/** Expose the whole minefield after a loss, marking the one that went off. */
export function detonate(board: Board, index: number): void {
  board.cells[index].detonated = true;
  for (const cell of board.cells) {
    if (cell.mine) cell.revealed = true;
  }
}

/** On a win, every remaining mine is implicitly accounted for — flag them all. */
export function flagAllMines(board: Board): void {
  for (const cell of board.cells) {
    if (cell.mine) cell.flagged = true;
  }
}
