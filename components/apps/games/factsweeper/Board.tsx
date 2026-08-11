'use client';

/**
 * Fact-sweeper — the grid.
 *
 * Input is delegated from the grid container rather than bound per cell, so a
 * 16x30 board carries three listeners instead of 1,440. The container is also
 * the only element that swallows `contextmenu` — right-clicking anywhere else
 * in the OS still behaves normally.
 */
import {
  useCallback,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { Board } from './engine';
import { colOf, rowOf } from './engine';
import { getFact } from './factPool';

/**
 * The canonical Minesweeper digit colours. There is no design token for these
 * and there shouldn't be — they belong to this one grid, and getting "1 is
 * blue, 2 is green, 3 is red" wrong is the fastest way to make a sweeper feel
 * like a knock-off. Raw hex is deliberate here.
 */
const NUMBER_COLORS = [
  '', // 0 renders blank
  '#0000f0',
  '#007000',
  '#e00000',
  '#000070',
  '#800000',
  '#008080',
  '#000000',
  '#707070',
] as const;

const LONG_PRESS_MS = 420;
const LONG_PRESS_SLOP = 10;

export interface BoardViewProps {
  board: Board;
  cellSize: number;
  /** Won or lost: the grid still renders but ignores input. */
  frozen: boolean;
  /** Keyboard cursor index. */
  cursor: number;
  /** Prefix for cell DOM ids so two windows never collide. */
  idPrefix: string;
  /** Touch-friendly mode: a plain tap plants a flag instead of digging. */
  flagMode: boolean;
  onPrimary: (index: number) => void;
  onFlag: (index: number) => void;
  onCursorChange: (index: number) => void;
}

function indexFromEvent(target: EventTarget | null): number | null {
  if (!(target instanceof globalThis.HTMLElement)) return null;
  const el = target.closest('[data-cell-index]');
  if (!(el instanceof globalThis.HTMLElement)) return null;
  const raw = el.dataset.cellIndex;
  if (raw === undefined) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

export function BoardView({
  board,
  cellSize,
  frozen,
  cursor,
  idPrefix,
  flagMode,
  onPrimary,
  onFlag,
  onCursorChange,
}: BoardViewProps) {
  const press = useRef<{
    timer: ReturnType<typeof setTimeout> | null;
    longFired: boolean;
    x: number;
    y: number;
  }>({ timer: null, longFired: false, x: 0, y: 0 });

  const cancelLongPress = useCallback(() => {
    if (press.current.timer !== null) {
      clearTimeout(press.current.timer);
      press.current.timer = null;
    }
  }, []);

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (frozen || e.pointerType === 'mouse') return;
      const index = indexFromEvent(e.target);
      if (index === null) return;
      press.current.longFired = false;
      press.current.x = e.clientX;
      press.current.y = e.clientY;
      cancelLongPress();
      press.current.timer = setTimeout(() => {
        press.current.longFired = true;
        press.current.timer = null;
        onFlag(index);
      }, LONG_PRESS_MS);
    },
    [frozen, cancelLongPress, onFlag],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (press.current.timer === null) return;
      // Treat a drag as a scroll attempt, not a flag.
      if (
        Math.abs(e.clientX - press.current.x) > LONG_PRESS_SLOP ||
        Math.abs(e.clientY - press.current.y) > LONG_PRESS_SLOP
      ) {
        cancelLongPress();
      }
    },
    [cancelLongPress],
  );

  const handleClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      cancelLongPress();
      // The click that follows a long-press flag must not also dig.
      if (press.current.longFired) {
        press.current.longFired = false;
        return;
      }
      const index = indexFromEvent(e.target);
      if (index === null) return;
      onCursorChange(index);
      if (flagMode) {
        if (!frozen) onFlag(index);
        return;
      }
      // Primary clicks are forwarded even on a finished board: the app turns
      // them into "re-read this sector's fact" rather than a dig.
      onPrimary(index);
    },
    [cancelLongPress, frozen, flagMode, onFlag, onPrimary, onCursorChange],
  );

  const handleContextMenu = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      // Scoped to the board only, as required — right-click elsewhere in the OS
      // is left alone.
      e.preventDefault();
      if (frozen) return;
      const index = indexFromEvent(e.target);
      if (index === null) return;
      onCursorChange(index);
      onFlag(index);
    },
    [frozen, onFlag, onCursorChange],
  );

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const r = rowOf(board, cursor);
      const c = colOf(board, cursor);
      const move = (nr: number, nc: number) => {
        e.preventDefault();
        const clampedR = Math.max(0, Math.min(board.rows - 1, nr));
        const clampedC = Math.max(0, Math.min(board.cols - 1, nc));
        onCursorChange(clampedR * board.cols + clampedC);
      };
      switch (e.key) {
        case 'ArrowUp':
          return move(r - 1, c);
        case 'ArrowDown':
          return move(r + 1, c);
        case 'ArrowLeft':
          return move(r, c - 1);
        case 'ArrowRight':
          return move(r, c + 1);
        case 'Home':
          return move(r, 0);
        case 'End':
          return move(r, board.cols - 1);
        case 'Enter':
        case ' ':
          e.preventDefault();
          onPrimary(cursor);
          return;
        case 'f':
        case 'F':
          e.preventDefault();
          if (!frozen) onFlag(cursor);
          return;
        default:
      }
    },
    [board, cursor, frozen, onPrimary, onFlag, onCursorChange],
  );

  const rows = Array.from({ length: board.rows }, (_, r) => r);

  return (
    <div className="os-inset inline-block rounded-[2px] p-[3px]">
      <div
        role="grid"
        aria-label="Disk recovery grid"
        aria-activedescendant={`${idPrefix}-cell-${cursor}`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onPointerLeave={cancelLongPress}
        className="grid select-none outline-none focus-visible:ring-2 focus-visible:ring-os-accent"
        style={{
          gridTemplateColumns: `repeat(${board.cols}, ${cellSize}px)`,
          gap: 1,
          background: 'var(--color-os-ink)',
          border: '1px solid var(--color-os-ink)',
        }}
      >
        {rows.map((r) => (
          // display:contents keeps the row in the grid's flow while still giving
          // the grid role a row structure to hang cells off.
          <div key={r} role="row" style={{ display: 'contents' }}>
            {Array.from({ length: board.cols }, (_, c) => {
              const index = r * board.cols + c;
              return (
                <CellView
                  key={index}
                  board={board}
                  index={index}
                  size={cellSize}
                  id={`${idPrefix}-cell-${index}`}
                  isCursor={index === cursor}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function CellView({
  board,
  index,
  size,
  id,
  isCursor,
}: {
  board: Board;
  index: number;
  size: number;
  id: string;
  isCursor: boolean;
}) {
  const cell = board.cells[index];
  const fact = cell.factId ? getFact(cell.factId) : null;

  let content: string = '';
  let color: string | undefined;
  let background = 'var(--color-os-chrome)';
  let shadow =
    'inset 1.5px 1.5px 0 0 #ffffff, inset -1.5px -1.5px 0 0 var(--color-os-chrome-dark)';
  let label: string;

  if (!cell.revealed) {
    if (cell.flagged) {
      content = '⚑';
      color = 'var(--color-os-alert)';
      label = 'flagged sector';
    } else {
      label = 'unread sector';
    }
  } else if (cell.mine) {
    content = '✷';
    background = cell.detonated ? 'var(--color-os-alert)' : 'var(--color-os-warn)';
    shadow = 'none';
    color = 'var(--color-os-ink)';
    label = cell.detonated ? 'corrupted sector, triggered' : 'corrupted sector';
  } else {
    background = 'var(--color-os-face)';
    shadow = 'none';
    if (cell.adjacent > 0) {
      content = String(cell.adjacent);
      color = NUMBER_COLORS[cell.adjacent];
    }
    label = fact
      ? `recovered ${fact.label}: ${fact.value}`
      : cell.adjacent > 0
        ? `${cell.adjacent} adjacent corrupted`
        : 'clear sector';
  }

  return (
    <div
      id={id}
      role="gridcell"
      data-cell-index={index}
      aria-label={`Row ${rowOf(board, index) + 1}, column ${colOf(board, index) + 1}, ${label}`}
      style={{
        width: size,
        height: size,
        background,
        boxShadow: shadow,
        color,
        fontSize: Math.max(9, Math.round(size * 0.52)),
      }}
      className="relative flex items-center justify-center font-[family-name:var(--font-os-ui)] leading-none"
    >
      {content}
      {/* Tiny corner tick marking a sector that yielded data. Click it again to
          re-read the fact in the readout. */}
      {cell.revealed && fact && (
        <span
          aria-hidden
          className="absolute left-[1px] top-[1px] h-[3px] w-[3px]"
          style={{
            background: cell.factRepeat
              ? 'var(--color-os-disabled)'
              : 'var(--color-os-accent)',
          }}
        />
      )}
      {isCursor && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ boxShadow: 'inset 0 0 0 2px var(--color-os-accent)' }}
        />
      )}
    </div>
  );
}
