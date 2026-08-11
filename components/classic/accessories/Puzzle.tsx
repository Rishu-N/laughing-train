'use client';

/**
 * Puzzle — the working 15-tile sliding puzzle.
 *
 * OWNER: Classic Boot agent.
 *
 * Board logic is in lib/classic/puzzle.ts. The shuffle walks legal moves back
 * from the solved board rather than permuting the tiles, because exactly half
 * of all arbitrary permutations of the 15-puzzle are unreachable and shipping
 * one of those is the classic way to break this toy.
 *
 * Arrow keys slide the tile in the named direction; clicking a tile next to the
 * gap slides it too.
 */
import { useCallback, useState, type KeyboardEvent } from 'react';
import { BIT_FONT, BitButton } from '@/components/classic/ui/Bit';
import {
  BLANK,
  SIZE,
  canMove,
  directionForKey,
  indexForDirection,
  isSolved,
  moveTile,
  shuffle,
  type Board,
} from '@/lib/classic/puzzle';

export default function Puzzle() {
  // Lazy init is safe here: a desk accessory only ever mounts in response to a
  // click, so this never runs during server rendering and cannot mismatch.
  const [board, setBoard] = useState<Board>(() => shuffle());
  const [moves, setMoves] = useState(0);

  const solved = isSolved(board);

  const slide = useCallback(
    (index: number | null) => {
      if (index === null) return;
      const next = moveTile(board, index);
      if (!next) return;
      setBoard(next);
      setMoves((m) => m + 1);
    },
    [board],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = directionForKey(e.key);
    if (!dir) return;
    // Arrow keys are ours; don't let them scroll anything behind us.
    e.preventDefault();
    e.stopPropagation();
    slide(indexForDirection(board, dir));
  };

  const mix = () => {
    setBoard(shuffle());
    setMoves(0);
  };

  return (
    <div
      className={`${BIT_FONT} flex h-full flex-col items-center gap-2 bg-white p-2 text-black`}
      onKeyDown={onKeyDown}
    >
      <div
        role="group"
        aria-label="Sliding puzzle"
        className="grid w-full max-w-[220px] gap-[2px] border border-black bg-black p-[2px]"
        style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
      >
        {board.map((tile, index) =>
          tile === BLANK ? (
            <div
              key="blank"
              aria-hidden="true"
              className="aspect-square bg-white"
            />
          ) : (
            <button
              key={tile}
              type="button"
              aria-label={`Tile ${tile}`}
              aria-disabled={!canMove(board, index) || undefined}
              onClick={() => slide(index)}
              className={[
                'flex aspect-square cursor-default items-center justify-center',
                'text-[13px] leading-none select-none',
                'focus-visible:shadow-[inset_0_0_0_2px_#000] focus-visible:outline-none',
                solved
                  ? 'bg-black text-white'
                  : 'bg-white text-black active:bg-black active:text-white',
              ].join(' ')}
            >
              {tile}
            </button>
          ),
        )}
      </div>

      <div className="flex w-full max-w-[220px] items-center justify-between gap-2">
        <span aria-live="polite" className="text-[9px] leading-none">
          {solved ? `Solved in ${moves}!` : `${moves} moves`}
        </span>
        <BitButton onClick={mix}>Mix</BitButton>
      </div>

      {solved && (
        <p className="w-full max-w-[220px] bg-black px-2 py-1 text-center text-[9px] leading-none text-white">
          ★ Nicely done ★
        </p>
      )}

      <p className="text-[8px] leading-none">Arrow keys slide tiles.</p>
    </div>
  );
}
