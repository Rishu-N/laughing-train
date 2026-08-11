'use client';

/**
 * Snake — grid game rendered on a <canvas>, chrome supplied by the shared OS
 * primitives. Game state lives in refs (not React state) so the tick loop never
 * fights re-renders; score/status are mirrored into state only for display.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { AppFrame, Button, IconButton, StatusBar, Toolbar, ToolbarSeparator } from '@/components/os/ui';
import { useAppSession } from '@/lib/os/persist';

/* ---------------------------------------------------------------- constants -- */

const GRID_SIZE = 16;
/** Starting/floor tick interval in ms. The snake speeds up as it grows. */
const START_INTERVAL_MS = 210;
const MIN_INTERVAL_MS = 70;
const INTERVAL_STEP_PER_SEGMENT = 6;
const SCORE_PER_FOOD = 10;
/** Clamp huge frame deltas (tab was backgrounded) so we don't catch-up-tick to death. */
const MAX_FRAME_DELTA_MS = 250;

/**
 * Canvas draw colours. Kept in one named object (rather than scattered raw hex)
 * so retheming the board only means editing these lines. Values mirror the
 * design tokens declared in app/globals.css.
 */
const CANVAS_COLORS = {
  board: '#ffffff', // --color-os-face
  gridLine: '#dcdcdc', // --color-os-chrome
  outline: '#000000', // --color-os-ink
  snakeHead: '#2b3fd8', // --color-os-accent
  snakeBody: '#1f8a3c', // --color-os-ok
  food: '#c8202a', // --color-os-alert
} as const;

interface Point {
  x: number;
  y: number;
}

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
} as const satisfies Record<string, Point>;

const KEY_DIR: Record<string, Point> = {
  ArrowUp: DIRS.up,
  KeyW: DIRS.up,
  ArrowDown: DIRS.down,
  KeyS: DIRS.down,
  ArrowLeft: DIRS.left,
  KeyA: DIRS.left,
  ArrowRight: DIRS.right,
  KeyD: DIRS.right,
};

type Status = 'idle' | 'playing' | 'paused' | 'gameover';

interface GameState {
  snake: Point[];
  /** Direction actually applied on the last tick. */
  dir: Point;
  /** Buffered input, applied at the start of the next tick. */
  nextDir: Point;
  food: Point;
}

function intervalForLength(length: number): number {
  return Math.max(MIN_INTERVAL_MS, START_INTERVAL_MS - (length - 3) * INTERVAL_STEP_PER_SEGMENT);
}

function randomFood(snake: Point[]): Point {
  const occupied = new Set(snake.map((p) => `${p.x},${p.y}`));
  const free: Point[] = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  if (free.length === 0) return { x: 0, y: 0 }; // board full — practically unreachable
  return free[Math.floor(Math.random() * free.length)];
}

function createInitialState(): GameState {
  const y = Math.floor(GRID_SIZE / 2);
  const x = Math.floor(GRID_SIZE / 2);
  const snake: Point[] = [
    { x, y },
    { x: x - 1, y },
    { x: x - 2, y },
  ];
  return { snake, dir: DIRS.right, nextDir: DIRS.right, food: randomFood(snake) };
}

interface SnakeSession {
  highScore: number;
}

export default function SnakeApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameState>(createInitialState());
  const scoreRef = useRef(0);
  const cellPxRef = useRef(16);

  const [status, setStatus] = useState<Status>('idle');
  const [scoreDisplay, setScoreDisplay] = useState(0);
  const [session, setSession] = useAppSession<SnakeSession>('snake', { highScore: 0 });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cell = cellPxRef.current;
    const size = GRID_SIZE * cell;

    ctx.fillStyle = CANVAS_COLORS.board;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = CANVAS_COLORS.gridLine;
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID_SIZE; i++) {
      const p = Math.round(i * cell) + 0.5;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }

    const gs = gameRef.current;
    const drawCell = (pt: Point, fill: string) => {
      const px = Math.round(pt.x * cell);
      const py = Math.round(pt.y * cell);
      const inset = Math.max(1, Math.round(cell * 0.08));
      ctx.fillStyle = fill;
      ctx.fillRect(px + inset, py + inset, cell - inset * 2, cell - inset * 2);
      ctx.strokeStyle = CANVAS_COLORS.outline;
      ctx.strokeRect(px + inset + 0.5, py + inset + 0.5, cell - inset * 2 - 1, cell - inset * 2 - 1);
    };

    drawCell(gs.food, CANVAS_COLORS.food);
    for (let i = gs.snake.length - 1; i >= 1; i--) {
      drawCell(gs.snake[i], CANVAS_COLORS.snakeBody);
    }
    if (gs.snake[0]) drawCell(gs.snake[0], CANVAS_COLORS.snakeHead);
  }, []);

  const endGame = useCallback(() => {
    setStatus('gameover');
    setSession((prev) => (scoreRef.current > prev.highScore ? { highScore: scoreRef.current } : prev));
  }, [setSession]);

  /** Advance the simulation by one tick. Returns false if the game just ended. */
  const tick = useCallback((): boolean => {
    const gs = gameRef.current;
    gs.dir = gs.nextDir;
    const head = gs.snake[0];
    const newHead: Point = { x: head.x + gs.dir.x, y: head.y + gs.dir.y };

    if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
      endGame();
      return false;
    }

    const willGrow = newHead.x === gs.food.x && newHead.y === gs.food.y;
    const bodyToCheck = willGrow ? gs.snake : gs.snake.slice(0, -1);
    if (bodyToCheck.some((p) => p.x === newHead.x && p.y === newHead.y)) {
      endGame();
      return false;
    }

    gs.snake = [newHead, ...gs.snake];
    if (willGrow) {
      scoreRef.current += SCORE_PER_FOOD;
      setScoreDisplay(scoreRef.current);
      gs.food = randomFood(gs.snake);
    } else {
      gs.snake.pop();
    }
    draw();
    return true;
  }, [draw, endGame]);

  // Game loop — runs only while playing, cleans itself up on pause/unmount/tab close.
  useEffect(() => {
    if (status !== 'playing') return;
    let raf = 0;
    let last = 0;
    let acc = 0;
    const step = (time: number) => {
      if (last === 0) last = time;
      const delta = Math.min(time - last, MAX_FRAME_DELTA_MS);
      last = time;
      acc += delta;
      const interval = intervalForLength(gameRef.current.snake.length);
      while (acc >= interval) {
        acc -= interval;
        if (!tick()) return; // game over — do not schedule another frame
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [status, tick]);

  // Size the canvas to its container, keeping it square and crisp at any DPR.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      const size = Math.max(GRID_SIZE, Math.floor(Math.min(rect.width, rect.height)));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      cellPxRef.current = size / GRID_SIZE;
      const ctx = canvas.getContext('2d');
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [draw]);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const applyDirection = (dir: Point) => {
    if (status !== 'playing') return;
    const gs = gameRef.current;
    // Ignore direct reversal — buffered so a fast double-tap can't turn the
    // snake back into its own neck before the next tick applies it.
    if (dir.x === -gs.dir.x && dir.y === -gs.dir.y) return;
    gs.nextDir = dir;
  };

  const handleNewGame = useCallback(() => {
    gameRef.current = createInitialState();
    scoreRef.current = 0;
    setScoreDisplay(0);
    setStatus('playing');
    draw();
    containerRef.current?.focus();
  }, [draw]);

  const handlePauseToggle = useCallback(() => {
    setStatus((s) => (s === 'playing' ? 'paused' : s === 'paused' ? 'playing' : s));
    containerRef.current?.focus();
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.code === 'Space') {
      e.preventDefault();
      handlePauseToggle();
      return;
    }
    const dir = KEY_DIR[e.code];
    if (!dir) return;
    e.preventDefault();
    applyDirection(dir);
  };

  const handleDpad = (dir: Point) => {
    applyDirection(dir);
    containerRef.current?.focus();
  };

  const showOverlay = status === 'idle' || status === 'gameover';

  return (
    <AppFrame
      scroll={false}
      toolbar={
        <Toolbar>
          <Button isDefault={status === 'idle'} onClick={handleNewGame}>
            New Game
          </Button>
          <ToolbarSeparator />
          <Button onClick={handlePauseToggle} disabled={status === 'idle' || status === 'gameover'}>
            {status === 'paused' ? 'Resume' : 'Pause'}
          </Button>
        </Toolbar>
      }
      status={
        <StatusBar>
          <span>Score {scoreDisplay}</span>
          <span aria-hidden>·</span>
          <span>Best {session.highScore}</span>
        </StatusBar>
      }
    >
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={() => containerRef.current?.focus()}
        className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 p-2 outline-none"
      >
        <div ref={wrapperRef} className="relative flex min-h-0 w-full flex-1 items-center justify-center">
          <canvas ref={canvasRef} className="os-inset" />
          {showOverlay && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-3">
              <div className="os-bevel pointer-events-auto max-w-full rounded-[3px] px-4 py-3 text-center">
                <p className="mb-1 os-chrome-text text-[12px] font-bold">
                  {status === 'gameover' ? 'Game Over' : 'Snake'}
                </p>
                {status === 'gameover' ? (
                  <p className="mb-2 os-chrome-text text-[11px]">Score {scoreDisplay}</p>
                ) : (
                  <p className="mb-2 os-chrome-text text-[10px] text-os-ink-soft">
                    Arrows or WASD to move
                  </p>
                )}
                <Button isDefault onClick={handleNewGame}>
                  {status === 'gameover' ? 'Play Again' : 'New Game'}
                </Button>
              </div>
            </div>
          )}
        </div>
        <div className="grid shrink-0 grid-cols-3 grid-rows-2 gap-1">
          <div />
          <IconButton label="Up" onClick={() => handleDpad(DIRS.up)}>
            ▲
          </IconButton>
          <div />
          <IconButton label="Left" onClick={() => handleDpad(DIRS.left)}>
            ◀
          </IconButton>
          <IconButton label="Down" onClick={() => handleDpad(DIRS.down)}>
            ▼
          </IconButton>
          <IconButton label="Right" onClick={() => handleDpad(DIRS.right)}>
            ▶
          </IconButton>
        </div>
      </div>
    </AppFrame>
  );
}
