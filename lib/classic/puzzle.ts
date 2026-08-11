/**
 * The 15-tile sliding puzzle, as pure board logic.
 *
 * OWNER: Classic Boot agent.
 *
 * ⚠️ The classic bug in this puzzle is shuffling by permuting the tiles: exactly
 * half of the 16! arrangements are unreachable, so a random permutation gives an
 * unsolvable board half the time. The only shuffle here walks backwards from the
 * solved board making legal moves, which cannot leave the solvable half.
 */

/** Board edge, in tiles. */
export const SIZE = 4;
export const CELLS = SIZE * SIZE;
/** The empty square is tile 0. */
export const BLANK = 0;

/** Row-major board: index = position on screen, value = tile number. */
export type Board = readonly number[];

export const SOLVED: Board = Array.from({ length: CELLS }, (_, i) =>
  i === CELLS - 1 ? BLANK : i + 1,
);

export function blankIndex(board: Board): number {
  const i = board.indexOf(BLANK);
  // A board without a blank is a programming error, not a user state.
  return i === -1 ? CELLS - 1 : i;
}

/** True when index `i` is orthogonally adjacent to the blank. */
export function canMove(board: Board, i: number): boolean {
  if (i < 0 || i >= CELLS || board[i] === BLANK) return false;
  const b = blankIndex(board);
  const dr = Math.abs(Math.floor(i / SIZE) - Math.floor(b / SIZE));
  const dc = Math.abs((i % SIZE) - (b % SIZE));
  return dr + dc === 1;
}

/** Every index that could legally slide right now. */
export function legalMoves(board: Board): number[] {
  const b = blankIndex(board);
  const row = Math.floor(b / SIZE);
  const col = b % SIZE;
  const out: number[] = [];
  if (row > 0) out.push(b - SIZE);
  if (row < SIZE - 1) out.push(b + SIZE);
  if (col > 0) out.push(b - 1);
  if (col < SIZE - 1) out.push(b + 1);
  return out;
}

/** Slide the tile at `i` into the blank. Returns null if that isn't legal. */
export function moveTile(board: Board, i: number): Board | null {
  if (!canMove(board, i)) return null;
  const next = board.slice();
  const b = blankIndex(board);
  next[b] = board[i];
  next[i] = BLANK;
  return next;
}

export function isSolved(board: Board): boolean {
  for (let i = 0; i < CELLS; i += 1) {
    if (board[i] !== SOLVED[i]) return false;
  }
  return true;
}

/**
 * Arrow-key direction names the way the TILE travels, not the blank: pressing
 * Left slides the tile on the right-hand side of the gap leftwards into it.
 */
export type Direction = 'up' | 'down' | 'left' | 'right';

/** Which index an arrow key would slide, or null at the edge of the board. */
export function indexForDirection(board: Board, dir: Direction): number | null {
  const b = blankIndex(board);
  const row = Math.floor(b / SIZE);
  const col = b % SIZE;
  switch (dir) {
    case 'left':
      return col < SIZE - 1 ? b + 1 : null;
    case 'right':
      return col > 0 ? b - 1 : null;
    case 'up':
      return row < SIZE - 1 ? b + SIZE : null;
    case 'down':
      return row > 0 ? b - SIZE : null;
  }
}

export function directionForKey(key: string): Direction | null {
  switch (key) {
    case 'ArrowUp':
      return 'up';
    case 'ArrowDown':
      return 'down';
    case 'ArrowLeft':
      return 'left';
    case 'ArrowRight':
      return 'right';
    default:
      return null;
  }
}

/**
 * Shuffle by walking `steps` legal moves back from the solved board, never
 * immediately undoing the previous move (which would waste half the walk). The
 * result is always solvable, and never already solved.
 */
export function shuffle(steps = 180, random: () => number = Math.random): Board {
  let board: Board = SOLVED;
  let previousBlank = -1;

  for (let n = 0; n < steps; n += 1) {
    const options = legalMoves(board).filter((i) => i !== previousBlank);
    const pick = options[Math.floor(random() * options.length)] ?? options[0];
    previousBlank = blankIndex(board);
    board = moveTile(board, pick) ?? board;
  }

  // Vanishingly unlikely, but a solved "shuffle" is a broken toy.
  if (isSolved(board)) return shuffle(steps + 1, random);
  return board;
}
