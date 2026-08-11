/**
 * Rishu, drawn.
 *
 * OWNER: Mascot agent.
 *
 * An original 16×20 pixel character: bowl-cut, one stubborn cowlick, a face
 * that is mostly grin, and a diamond badge on his chest. He is nobody's
 * copyright — no Apple mark, bitmap or silhouette is referenced here, only the
 * general idea of a 1-bit sprite.
 *
 * Two frames. He stands, he winks and throws a hand up, he goes.
 *
 *   '.'  transparent
 *   '#'  ink        (black in both shells)
 *   'o'  face       (white — keeps him legible over the blue desktop)
 *   'a'  badge      (ink in the 1-bit shell, the accent blue in the colour OS)
 *
 * Drawn as run-length-merged <rect>s with shapeRendering="crispEdges", so it
 * stays a hard pixel grid at any scale and needs no external asset.
 */
import type { RishuContext } from './rishuOdds';

export type RishuFrame = 'stand' | 'wink';

/** Grid size. Every row string below must be exactly SPRITE_W characters. */
export const SPRITE_W = 16;
export const SPRITE_H = 20;

/** Standing: arms down, both eyes open, cowlick leaning right. */
const STAND: readonly string[] = [
  '........##......',
  '....########....',
  '...##########...',
  '...##########...',
  '...#oooooooo#...',
  '...#o##oo##o#...',
  '...#o##oo##o#...',
  '...#oooooooo#...',
  '...#o#oooo#o#...',
  '...#oo####oo#...',
  '...##########...',
  '......####......',
  '...##########...',
  '...##oooooo##...',
  '...##ooaaoo##...',
  '...##oooooo##...',
  '..###oooooo###..',
  '....########....',
  '....##....##....',
  '...###....###...',
];

/**
 * Winking: his left eye (screen right) squeezes to a single-row dash, the
 * cowlick springs, and the near arm goes up in a half-wave. Same silhouette
 * everywhere else, so the swap reads as a gesture rather than a new sprite.
 */
const WINK: readonly string[] = [
  '.........##.....',
  '....########....',
  '...##########...',
  '...##########...',
  '...#oooooooo#...',
  '...#o##ooooo#...',
  '...#o##oo##o#...',
  '...#oooooooo#...',
  '...#o#oooo#o#.##',
  '...#oo####oo#.#.',
  '...##########.#.',
  '......####....#.',
  '...############.',
  '...##oooooo#....',
  '...##ooaaoo#....',
  '...##oooooo#....',
  '..###oooooo##...',
  '....########....',
  '....##....##....',
  '...###....###...',
];

const FRAMES: Record<RishuFrame, readonly string[]> = { stand: STAND, wink: WINK };

interface Run {
  x: number;
  y: number;
  w: number;
  cell: string;
}

/** Merge each row into horizontal runs so a frame is ~40 rects, not 320. */
function toRuns(rows: readonly string[]): Run[] {
  const runs: Run[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const cell = row[x];
      let w = 1;
      while (x + w < row.length && row[x + w] === cell) w += 1;
      if (cell !== '.') runs.push({ x, y, w, cell });
      x += w;
    }
  });
  return runs;
}

const RUNS: Record<RishuFrame, Run[]> = {
  stand: toRuns(STAND),
  wink: toRuns(WINK),
};

/**
 * Colours come from the design tokens, never raw hex — which also means the
 * classic shell gets literal black-and-white for free, since --color-os-ink is
 * #000 and --color-os-face is #fff. Only the chest badge differs by context.
 */
function fillFor(cell: string, context: RishuContext): string {
  if (cell === 'o') return 'var(--color-os-face)';
  if (cell === 'a') {
    return context === 'color' ? 'var(--color-os-accent)' : 'var(--color-os-ink)';
  }
  return 'var(--color-os-ink)';
}

export interface RishuSpriteProps {
  frame: RishuFrame;
  context: RishuContext;
  /** Mirror him so he faces into the screen when he's stood at a right edge. */
  flip?: boolean;
  /** Size of one sprite pixel, in CSS px. */
  pixel?: number;
}

export default function RishuSprite({
  frame,
  context,
  flip = false,
  pixel = 3,
}: RishuSpriteProps) {
  const runs = RUNS[frame] ?? RUNS.stand;
  return (
    <svg
      width={SPRITE_W * pixel}
      height={SPRITE_H * pixel}
      viewBox={`0 0 ${SPRITE_W} ${SPRITE_H}`}
      shapeRendering="crispEdges"
      focusable="false"
      aria-hidden="true"
      style={{
        display: 'block',
        // Belt and braces: the overlay already disables hit-testing, but this
        // sprite must never be able to swallow a click, ever.
        pointerEvents: 'none',
        transform: flip ? 'scaleX(-1)' : undefined,
        imageRendering: 'pixelated',
      }}
    >
      {runs.map((run) => (
        <rect
          key={`${frame}-${run.y}-${run.x}`}
          x={run.x}
          y={run.y}
          width={run.w}
          height={1}
          fill={fillFor(run.cell, context)}
        />
      ))}
    </svg>
  );
}

/** Exported for eyeballing the grid in isolation; not used at runtime. */
export const RISHU_FRAMES = FRAMES;
