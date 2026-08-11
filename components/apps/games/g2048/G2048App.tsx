'use client';

/**
 * 2048 — 4x4 sliding tile game. Board logic lives in ./logic.ts; this file is
 * the OS chrome, input handling and Framer Motion presentation.
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type TouchEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppFrame, Button, StatusBar, Toolbar, ToolbarSeparator } from '@/components/os/ui';
import { useAppSession } from '@/lib/os/persist';
import { GRID_SIZE, applyMove, canMove, spawnTile, type Direction, type Tile } from './logic';

/* ---------------------------------------------------------------- constants -- */

const SWIPE_THRESHOLD_PX = 24;
const WIN_VALUE = 2048;

const KEY_DIR: Record<string, Direction> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

/**
 * Tile colour ramp built entirely from OS design tokens (with opacity
 * modifiers for the middle steps) — deliberately not the standard 2048 beige.
 */
const TILE_STYLES: { value: number; className: string }[] = [
  { value: 2, className: 'bg-os-chrome text-os-ink' },
  { value: 4, className: 'bg-os-chrome-dim text-os-ink' },
  { value: 8, className: 'bg-os-accent-soft text-os-ink' },
  { value: 16, className: 'bg-os-accent/35 text-os-ink' },
  { value: 32, className: 'bg-os-accent/55 text-os-face' },
  { value: 64, className: 'bg-os-accent/75 text-os-face' },
  { value: 128, className: 'bg-os-warn/70 text-os-ink' },
  { value: 256, className: 'bg-os-warn text-os-ink' },
  { value: 512, className: 'bg-os-ok/80 text-os-face' },
  { value: 1024, className: 'bg-os-ok text-os-face' },
  { value: WIN_VALUE, className: 'bg-os-accent text-os-face' },
];
const OVERFLOW_TILE_CLASS = 'bg-os-alert text-os-face';

function tileClassName(value: number): string {
  return TILE_STYLES.find((t) => t.value === value)?.className ?? OVERFLOW_TILE_CLASS;
}

function fontSizeClass(value: number): string {
  const digits = String(value).length;
  if (digits <= 2) return 'text-[22px]';
  if (digits === 3) return 'text-[18px]';
  return 'text-[14px]';
}

type Status = 'playing' | 'won' | 'gameover';

interface G2048Session {
  best: number;
}

/**
 * Tile ids only have to be unique among the tiles currently on screen, so a
 * monotonic module-level sequence is enough. Keeping it out of a ref means the
 * opening board can be dealt in a lazy `useState` initialiser instead of an
 * effect — no mount-time setState, and no chance of a recycled id colliding
 * with a tile still playing its exit animation after "New Game".
 */
let tileIdSeq = 0;
function nextTileId(): number {
  tileIdSeq += 1;
  return tileIdSeq;
}

/** Deals a fresh two-tile opening board. */
function dealBoard(): Tile[] {
  const first = spawnTile([], nextTileId);
  const rest = first ? spawnTile([first], nextTileId) : null;
  return [first, rest].filter((t): t is Tile => t !== null);
}

export default function G2048App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const [tiles, setTiles] = useState<Tile[]>(dealBoard);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<Status>('playing');
  const [wonAcknowledged, setWonAcknowledged] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState<{ tiles: Tile[]; score: number } | null>(null);
  const [session, setSession] = useAppSession<G2048Session>('g2048', { best: 0 });

  const newGame = useCallback(() => {
    setTiles(dealBoard());
    setScore(0);
    setStatus('playing');
    setWonAcknowledged(false);
    setUndoSnapshot(null);
    containerRef.current?.focus();
  }, []);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const handleMove = (dir: Direction) => {
    if (status !== 'playing') return;
    const result = applyMove(tiles, dir);
    if (!result.moved) return;

    const spawned = spawnTile(result.tiles, nextTileId);
    const nextTiles = spawned ? [...result.tiles, spawned] : result.tiles;
    const nextScore = score + result.gained;

    setUndoSnapshot({ tiles, score });
    setTiles(nextTiles);
    setScore(nextScore);
    setSession((prev) => (nextScore > prev.best ? { best: nextScore } : prev));

    if (!wonAcknowledged && nextTiles.some((t) => t.value >= WIN_VALUE)) {
      setStatus('won');
    } else if (!canMove(nextTiles)) {
      setStatus('gameover');
    }
  };

  const handleUndo = () => {
    if (!undoSnapshot) return;
    setTiles(undoSnapshot.tiles);
    setScore(undoSnapshot.score);
    setWonAcknowledged(undoSnapshot.tiles.some((t) => t.value >= WIN_VALUE));
    setStatus('playing');
    setUndoSnapshot(null);
    containerRef.current?.focus();
  };

  const handleKeepPlaying = () => {
    setWonAcknowledged(true);
    setStatus('playing');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = KEY_DIR[e.code];
    if (!dir) return;
    e.preventDefault();
    handleMove(dir);
  };

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD_PX) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      handleMove(dx > 0 ? 'right' : 'left');
    } else {
      handleMove(dy > 0 ? 'down' : 'up');
    }
  };

  const showOverlay = status === 'won' || status === 'gameover';

  return (
    <AppFrame
      scroll={false}
      toolbar={
        <Toolbar>
          <Button isDefault onClick={newGame}>
            New Game
          </Button>
          <ToolbarSeparator />
          <Button onClick={handleUndo} disabled={!undoSnapshot}>
            Undo
          </Button>
        </Toolbar>
      }
      status={
        <StatusBar>
          <span>Score {score}</span>
          <span aria-hidden>·</span>
          <span>Best {session.best}</span>
        </StatusBar>
      }
    >
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={() => containerRef.current?.focus()}
        className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 p-3 outline-none"
      >
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{ aspectRatio: '1 / 1', touchAction: 'none' }}
          className="os-inset relative grid w-full max-w-[380px] grid-cols-4 grid-rows-4 gap-2 p-2"
        >
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => (
            <div
              key={i}
              className="rounded-[2px] bg-os-well"
              style={{
                gridColumnStart: (i % GRID_SIZE) + 1,
                gridRowStart: Math.floor(i / GRID_SIZE) + 1,
              }}
            />
          ))}

          <AnimatePresence>
            {tiles.map((t) => (
              <motion.div
                key={t.id}
                layout
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.3, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                style={{ gridColumnStart: t.c + 1, gridRowStart: t.r + 1 }}
                className={`flex items-center justify-center rounded-[2px] border border-os-ink font-[family-name:var(--font-os-ui)] font-bold ${tileClassName(t.value)} ${fontSizeClass(t.value)}`}
              >
                {t.value}
              </motion.div>
            ))}
          </AnimatePresence>

          {showOverlay && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-2">
              <div className="os-bevel pointer-events-auto max-w-full rounded-[3px] px-4 py-3 text-center">
                <p className="mb-1 os-chrome-text text-[12px] font-bold">
                  {status === 'won' ? 'You made 2048!' : 'Game Over'}
                </p>
                <p className="mb-2 os-chrome-text text-[11px]">Score {score}</p>
                <div className="flex justify-center gap-2">
                  {status === 'won' && <Button onClick={handleKeepPlaying}>Keep Playing</Button>}
                  <Button isDefault onClick={newGame}>
                    New Game
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppFrame>
  );
}
