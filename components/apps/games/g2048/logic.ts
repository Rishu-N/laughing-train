/**
 * Pure 2048 board logic — no React, no DOM. Kept separate from the component so
 * the merge/slide algorithm can be read (and reasoned about) on its own.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Tile {
  id: number;
  r: number;
  c: number;
  value: number;
}

export const GRID_SIZE = 4;

function emptyCells(tiles: Tile[]): { r: number; c: number }[] {
  const occupied = new Set(tiles.map((t) => `${t.r},${t.c}`));
  const cells: { r: number; c: number }[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!occupied.has(`${r},${c}`)) cells.push({ r, c });
    }
  }
  return cells;
}

/** Places a new 2 (90%) or 4 (10%) tile on a random empty cell. Null if the board is full. */
export function spawnTile(tiles: Tile[], nextId: () => number): Tile | null {
  const cells = emptyCells(tiles);
  if (cells.length === 0) return null;
  const cell = cells[Math.floor(Math.random() * cells.length)];
  const value = Math.random() < 0.9 ? 2 : 4;
  return { id: nextId(), r: cell.r, c: cell.c, value };
}

/** Slides one row/column (already ordered leading-edge-first) and merges equal neighbours once. */
function collapseLine(line: Tile[]): { line: Tile[]; gained: number } {
  const result: Tile[] = [];
  let gained = 0;
  let i = 0;
  while (i < line.length) {
    const cur = line[i];
    const next = line[i + 1];
    if (next && next.value === cur.value) {
      // Surviving tile keeps `cur`'s id so Framer Motion animates it in place
      // instead of treating the merge as a remount.
      result.push({ ...cur, value: cur.value * 2 });
      gained += cur.value * 2;
      i += 2;
    } else {
      result.push(cur);
      i += 1;
    }
  }
  return { line: result, gained };
}

function boardsEqual(a: Tile[], b: Tile[]): boolean {
  if (a.length !== b.length) return false;
  const map = new Map(a.map((t) => [t.id, t]));
  return b.every((t) => {
    const prev = map.get(t.id);
    return !!prev && prev.r === t.r && prev.c === t.c && prev.value === t.value;
  });
}

/** Applies one move to the whole board. `moved` is false for a no-op (nothing to slide/merge). */
export function applyMove(
  tiles: Tile[],
  dir: Direction,
): { tiles: Tile[]; gained: number; moved: boolean } {
  const lines: Tile[][] = [];
  if (dir === 'left' || dir === 'right') {
    for (let r = 0; r < GRID_SIZE; r++) {
      lines.push(
        tiles.filter((t) => t.r === r).sort((a, b) => (dir === 'left' ? a.c - b.c : b.c - a.c)),
      );
    }
  } else {
    for (let c = 0; c < GRID_SIZE; c++) {
      lines.push(
        tiles.filter((t) => t.c === c).sort((a, b) => (dir === 'up' ? a.r - b.r : b.r - a.r)),
      );
    }
  }

  let gained = 0;
  const nextTiles: Tile[] = [];
  lines.forEach((line, lineIndex) => {
    const { line: collapsed, gained: g } = collapseLine(line);
    gained += g;
    collapsed.forEach((tile, idx) => {
      let r = tile.r;
      let c = tile.c;
      if (dir === 'left') {
        r = lineIndex;
        c = idx;
      } else if (dir === 'right') {
        r = lineIndex;
        c = GRID_SIZE - 1 - idx;
      } else if (dir === 'up') {
        c = lineIndex;
        r = idx;
      } else {
        c = lineIndex;
        r = GRID_SIZE - 1 - idx;
      }
      nextTiles.push({ ...tile, r, c });
    });
  });

  return { tiles: nextTiles, gained, moved: !boardsEqual(tiles, nextTiles) };
}

/** True if any move would change the board — a full board with no equal neighbours is game over. */
export function canMove(tiles: Tile[]): boolean {
  if (tiles.length < GRID_SIZE * GRID_SIZE) return true;
  const grid = new Map(tiles.map((t) => [`${t.r},${t.c}`, t.value]));
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const v = grid.get(`${r},${c}`);
      const right = grid.get(`${r},${c + 1}`);
      const down = grid.get(`${r + 1},${c}`);
      if (right !== undefined && right === v) return true;
      if (down !== undefined && down === v) return true;
    }
  }
  return false;
}
