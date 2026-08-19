/**
 * The 1984 paint program's raster engine, with no canvas and no JSX in sight.
 *
 * OWNER: Classic Boot agent.
 *
 * The document model is a plain `Uint8Array` — one byte per pixel, 1 is black
 * and 0 is paper. Not RGBA, not an `ImageData`, not the canvas itself. Keeping
 * the model that dumb is what lets every drawing operation below be a pure
 * function you can reason about, and it makes the canvas element a *view* that
 * happens to be the fastest way to show a bitmap, rather than the place the
 * document lives.
 *
 * It also happens to be honest about the machine being imitated: this really is
 * a one-bit-per-pixel frame buffer, and the "grays" really are dither.
 */
import type { CSSProperties } from 'react';
import { PATTERNS, patternStyle } from '@/lib/classic/patterns';

/**
 * The frame buffer. 320×200 is a compromise: chunky enough that a scaled-up
 * pixel reads as a *pixel*, small enough that a packed snapshot is 8 KB and the
 * 24-deep undo stack costs less than a single screenshot would.
 */
export const PAINT_WIDTH = 320;
export const PAINT_HEIGHT = 200;

/** Namespaced away from the colour OS's `paint`, which is a different program. */
export const PAINT_SESSION_ID = 'classic-paint';

/** One byte per pixel: 1 = black, 0 = paper. */
export type Bitmap = Uint8Array;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A lifted rectangle of pixels, as the marquee carries it around. */
export interface Region {
  w: number;
  h: number;
  data: Bitmap;
}

/* ------------------------------------------------------------- patterns ---- */

/**
 * The raster twin of `lib/classic/patterns.ts`.
 *
 * The shared patterns are SVG `url()` tiles, which is right for a CSS
 * background and useless for a flood fill — you cannot ask a background-image
 * what colour pixel (37, 12) is. So each pattern gets an 8×8 character map
 * here, transcribed from the same definitions and keyed by the same id. The
 * swatches in the UI still render with `patternStyle()`, so the two cannot
 * drift apart without it being obvious on screen.
 *
 * '#' is black, anything else is paper — the same notation as icons.ts.
 */
type Tile = readonly string[];

const SOLID_BLACK: Tile = Array.from({ length: 8 }, () => '########');
const SOLID_WHITE: Tile = Array.from({ length: 8 }, () => '........');

const RASTER: Record<string, Tile> = {
  white: SOLID_WHITE,
  'dots-12': [
    '........',
    '.#...#..',
    '........',
    '........',
    '........',
    '.#...#..',
    '........',
    '........',
  ],
  'dots-25': [
    '#...#...',
    '........',
    '..#...#.',
    '........',
    '#...#...',
    '........',
    '..#...#.',
    '........',
  ],
  checker: [
    '#.#.#.#.',
    '.#.#.#.#',
    '#.#.#.#.',
    '.#.#.#.#',
    '#.#.#.#.',
    '.#.#.#.#',
    '#.#.#.#.',
    '.#.#.#.#',
  ],
  weave: [
    '########',
    '........',
    '#.#.#.#.',
    '........',
    '########',
    '........',
    '#.#.#.#.',
    '........',
  ],
  rules: [
    '########',
    '........',
    '........',
    '........',
    '########',
    '........',
    '........',
    '........',
  ],
  grid: [
    '########',
    '#.......',
    '#.......',
    '#.......',
    '#.......',
    '#.......',
    '#.......',
    '#.......',
  ],
  twill: [
    '#...#...',
    '.#...#..',
    '..#...#.',
    '...#...#',
    '#...#...',
    '.#...#..',
    '..#...#.',
    '...#...#',
  ],
};

export interface PaintPattern {
  id: string;
  label: string;
  tile: Tile;
  /** How the swatch is drawn in the palette — straight from patterns.ts. */
  style: CSSProperties;
}

/**
 * Black first, then paper, then the six dithers. MacPaint led with the two
 * extremes for the same reason: they are the two you reach for constantly and
 * everything else is a shade between them.
 */
export const PAINT_PALETTE: readonly PaintPattern[] = [
  { id: 'black', label: 'Black', tile: SOLID_BLACK, style: { backgroundColor: '#000' } },
  ...PATTERNS.map((p, i) => ({
    id: p.id,
    label: p.label,
    // A pattern added to patterns.ts without a raster twin falls back to solid
    // rather than silently filling with nothing.
    tile: RASTER[p.id] ?? SOLID_BLACK,
    style: patternStyle(i),
  })),
];

/** The paper swatch, i.e. the one the eraser paints with. */
export const WHITE_INK: PaintPattern = {
  id: 'paper',
  label: 'Paper',
  tile: SOLID_WHITE,
  style: { backgroundColor: '#fff' },
};

export const BLACK_INK: PaintPattern = PAINT_PALETTE[0];

/** Patterns are anchored to the canvas, not the stroke, so fills line up. */
export function inkAt(ink: PaintPattern, x: number, y: number): number {
  const row = ink.tile[((y % 8) + 8) % 8] ?? '';
  return row[((x % 8) + 8) % 8] === '#' ? 1 : 0;
}

/* ----------------------------------------------------------------- tools ---- */

export type ToolId =
  | 'pencil'
  | 'brush'
  | 'eraser'
  | 'line'
  | 'rect'
  | 'rect-filled'
  | 'oval'
  | 'oval-filled'
  | 'bucket'
  | 'marquee'
  | 'text';

export type BrushShape = 'round' | 'square' | 'slash';

export const BRUSH_SHAPES: readonly BrushShape[] = ['round', 'square', 'slash'];

/** MacPaint's line-weight well, in pixels of the frame buffer. */
export const LINE_WEIGHTS: readonly number[] = [1, 2, 3, 5];

/* ------------------------------------------------------------- the buffer ---- */

export function createBitmap(): Bitmap {
  return new Uint8Array(PAINT_WIDTH * PAINT_HEIGHT);
}

export function cloneBitmap(bmp: Bitmap): Bitmap {
  return new Uint8Array(bmp);
}

export function getPixel(bmp: Bitmap, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= PAINT_WIDTH || y >= PAINT_HEIGHT) return 0;
  return bmp[y * PAINT_WIDTH + x];
}

export function setPixel(bmp: Bitmap, x: number, y: number, value: number): void {
  if (x < 0 || y < 0 || x >= PAINT_WIDTH || y >= PAINT_HEIGHT) return;
  bmp[y * PAINT_WIDTH + x] = value;
}

/** Paint one pixel with the pattern showing through. */
function ink(bmp: Bitmap, x: number, y: number, pattern: PaintPattern): void {
  setPixel(bmp, x, y, inkAt(pattern, x, y));
}

/* ------------------------------------------------------------- primitives ---- */

/**
 * One dab of a brush. `size` is the diameter; odd sizes centre exactly and even
 * ones lean up-left, which is what a 1-bit machine did too — there is no half
 * pixel to split the difference into.
 */
export function stamp(
  bmp: Bitmap,
  cx: number,
  cy: number,
  shape: BrushShape,
  size: number,
  pattern: PaintPattern,
): void {
  const half = Math.floor(size / 2);
  if (size <= 1) {
    ink(bmp, cx, cy, pattern);
    return;
  }
  if (shape === 'slash') {
    // A calligraphic nib: a 45° bar, so horizontal strokes read heavy and
    // vertical ones read light.
    for (let i = 0; i < size; i += 1) ink(bmp, cx - half + i, cy + half - i, pattern);
    return;
  }
  const r = size / 2;
  for (let dy = -half; dy <= half; dy += 1) {
    for (let dx = -half; dx <= half; dx += 1) {
      if (shape === 'round' && dx * dx + dy * dy > r * r) continue;
      ink(bmp, cx + dx, cy + dy, pattern);
    }
  }
}

/** Bresenham, stamping the brush at every step. */
export function strokeLine(
  bmp: Bitmap,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  shape: BrushShape,
  size: number,
  pattern: PaintPattern,
): void {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const ex = Math.round(x1);
  const ey = Math.round(y1);
  const dx = Math.abs(ex - x);
  const dy = -Math.abs(ey - y);
  const sx = x < ex ? 1 : -1;
  const sy = y < ey ? 1 : -1;
  let err = dx + dy;

  for (;;) {
    stamp(bmp, x, y, shape, size, pattern);
    if (x === ex && y === ey) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/**
 * The pencil is the one tool that ignores the pattern well: it lays down black,
 * and lifts it again if the pixel you started on was already black. That toggle
 * is the whole reason the pencil existed alongside the brush.
 */
export function pencilValue(bmp: Bitmap, x: number, y: number): number {
  return getPixel(bmp, x, y) === 1 ? 0 : 1;
}

export function strokePencil(
  bmp: Bitmap,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  value: number,
): void {
  const solid = value === 1 ? BLACK_INK : WHITE_INK;
  strokeLine(bmp, x0, y0, x1, y1, 'square', 1, solid);
}

export function normalizeRect(x0: number, y0: number, x1: number, y1: number): Rect {
  const left = Math.max(0, Math.min(x0, x1));
  const top = Math.max(0, Math.min(y0, y1));
  const right = Math.min(PAINT_WIDTH - 1, Math.max(x0, x1));
  const bottom = Math.min(PAINT_HEIGHT - 1, Math.max(y0, y1));
  return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

export function fillRect(bmp: Bitmap, r: Rect, pattern: PaintPattern): void {
  for (let y = r.y; y < r.y + r.h; y += 1) {
    for (let x = r.x; x < r.x + r.w; x += 1) ink(bmp, x, y, pattern);
  }
}

export function outlineRect(
  bmp: Bitmap,
  r: Rect,
  weight: number,
  pattern: PaintPattern,
): void {
  const x1 = r.x + r.w - 1;
  const y1 = r.y + r.h - 1;
  strokeLine(bmp, r.x, r.y, x1, r.y, 'square', weight, pattern);
  strokeLine(bmp, r.x, y1, x1, y1, 'square', weight, pattern);
  strokeLine(bmp, r.x, r.y, r.x, y1, 'square', weight, pattern);
  strokeLine(bmp, x1, r.y, x1, y1, 'square', weight, pattern);
}

/** Scanline ellipse inscribed in the rectangle — same box as the rect tools. */
export function fillOval(bmp: Bitmap, r: Rect, pattern: PaintPattern): void {
  const rx = r.w / 2;
  const ry = r.h / 2;
  const cx = r.x + rx - 0.5;
  const cy = r.y + ry - 0.5;
  if (rx <= 0 || ry <= 0) return;

  for (let y = r.y; y < r.y + r.h; y += 1) {
    const dy = (y - cy) / ry;
    const inside = 1 - dy * dy;
    if (inside < 0) continue;
    const span = rx * Math.sqrt(inside);
    const from = Math.round(cx - span);
    const to = Math.round(cx + span);
    for (let x = from; x <= to; x += 1) ink(bmp, x, y, pattern);
  }
}

/**
 * Outline by subtraction: rasterise the solid ellipse, rasterise the one inset
 * by the line weight, and keep the difference. Slower than a midpoint tracer
 * and immune to the gaps a naive one leaves on a squashed ellipse.
 */
export function outlineOval(
  bmp: Bitmap,
  r: Rect,
  weight: number,
  pattern: PaintPattern,
): void {
  const outer = createBitmap();
  fillOval(outer, r, BLACK_INK);
  const inner = createBitmap();
  const w = Math.max(1, Math.round(weight));
  const shrunk: Rect = {
    x: r.x + w,
    y: r.y + w,
    w: r.w - w * 2,
    h: r.h - w * 2,
  };
  if (shrunk.w > 0 && shrunk.h > 0) fillOval(inner, shrunk, BLACK_INK);

  for (let y = r.y; y < r.y + r.h; y += 1) {
    for (let x = r.x; x < r.x + r.w; x += 1) {
      if (getPixel(outer, x, y) === 1 && getPixel(inner, x, y) === 0) {
        ink(bmp, x, y, pattern);
      }
    }
  }
}

/**
 * Scanline flood fill. The queue holds spans rather than pixels, so filling a
 * blank 320×200 canvas is a few hundred iterations instead of 64,000 — the
 * naive four-way recursion blows the stack on a bitmap this size.
 */
export function floodFill(
  bmp: Bitmap,
  startX: number,
  startY: number,
  pattern: PaintPattern,
): void {
  const sx = Math.round(startX);
  const sy = Math.round(startY);
  if (sx < 0 || sy < 0 || sx >= PAINT_WIDTH || sy >= PAINT_HEIGHT) return;

  const target = getPixel(bmp, sx, sy);
  const done = new Uint8Array(bmp.length);
  const stack: number[] = [sx, sy];

  while (stack.length > 0) {
    const y = stack.pop() as number;
    let x = stack.pop() as number;

    while (x > 0 && bmp[y * PAINT_WIDTH + x - 1] === target && !done[y * PAINT_WIDTH + x - 1]) {
      x -= 1;
    }
    let spanAbove = false;
    let spanBelow = false;

    for (; x < PAINT_WIDTH; x += 1) {
      const i = y * PAINT_WIDTH + x;
      if (done[i] || bmp[i] !== target) break;
      done[i] = 1;
      ink(bmp, x, y, pattern);

      const upAvailable = y > 0 && bmp[i - PAINT_WIDTH] === target && !done[i - PAINT_WIDTH];
      if (!spanAbove && upAvailable) {
        stack.push(x, y - 1);
        spanAbove = true;
      } else if (spanAbove && !upAvailable) {
        spanAbove = false;
      }

      const downAvailable =
        y < PAINT_HEIGHT - 1 && bmp[i + PAINT_WIDTH] === target && !done[i + PAINT_WIDTH];
      if (!spanBelow && downAvailable) {
        stack.push(x, y + 1);
        spanBelow = true;
      } else if (spanBelow && !downAvailable) {
        spanBelow = false;
      }
    }
  }
}

/* ---------------------------------------------------------------- regions ---- */

export function copyRegion(bmp: Bitmap, r: Rect): Region {
  const data = new Uint8Array(r.w * r.h);
  for (let y = 0; y < r.h; y += 1) {
    for (let x = 0; x < r.w; x += 1) {
      data[y * r.w + x] = getPixel(bmp, r.x + x, r.y + y);
    }
  }
  return { w: r.w, h: r.h, data };
}

export function eraseRegion(bmp: Bitmap, r: Rect): void {
  fillRect(bmp, r, WHITE_INK);
}

/** Paste opaquely — white pixels in the region stay white, as a marquee did. */
export function pasteRegion(bmp: Bitmap, region: Region, x: number, y: number): void {
  for (let ry = 0; ry < region.h; ry += 1) {
    for (let rx = 0; rx < region.w; rx += 1) {
      setPixel(bmp, x + rx, y + ry, region.data[ry * region.w + rx]);
    }
  }
}

/* ------------------------------------------------------------------- text ---- */

/**
 * Threshold a canvas alpha channel into 1-bit coverage.
 *
 * Canvas text is anti-aliased and there is nothing to be done about that, so
 * everything it draws gets flattened here: over half-opaque is a pixel, under
 * is paper. That hard cut is what keeps the text tool from smuggling grays into
 * a black-and-white document.
 */
export function maskFromAlpha(rgba: Uint8ClampedArray, threshold = 128): Uint8Array {
  const mask = new Uint8Array(rgba.length / 4);
  for (let i = 0; i < mask.length; i += 1) {
    mask[i] = rgba[i * 4 + 3] >= threshold ? 1 : 0;
  }
  return mask;
}

/** OR a full-canvas mask into the document, tinted by the pattern. */
export function applyMask(bmp: Bitmap, mask: Uint8Array, pattern: PaintPattern): void {
  for (let y = 0; y < PAINT_HEIGHT; y += 1) {
    for (let x = 0; x < PAINT_WIDTH; x += 1) {
      if (mask[y * PAINT_WIDTH + x] === 1) ink(bmp, x, y, pattern);
    }
  }
}

/* ---------------------------------------------------------------- viewing ---- */

/**
 * Expand the frame buffer into RGBA bytes for `putImageData`.
 *
 * The buffer type is pinned to `ArrayBuffer` rather than `ArrayBufferLike`
 * because the `ImageData` constructor refuses anything that might be a
 * `SharedArrayBuffer`, and this one demonstrably never is.
 */
export function toRGBA(bmp: Bitmap): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(new ArrayBuffer(bmp.length * 4));
  for (let i = 0; i < bmp.length; i += 1) {
    const v = bmp[i] === 1 ? 0 : 255;
    out[i * 4] = v;
    out[i * 4 + 1] = v;
    out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  return out;
}

/**
 * Map a client point onto a frame-buffer pixel.
 *
 * One scale factor, taken from the element's own box. Deliberately no
 * devicePixelRatio arithmetic: the backing store is a fixed 320×200 and CSS
 * stretches it, so the ratio never enters the sum and there is nothing to get
 * subtly wrong on a retina display.
 */
export function clientToPixel(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const x = Math.floor(((clientX - rect.left) / rect.width) * PAINT_WIDTH);
  const y = Math.floor(((clientY - rect.top) / rect.height) * PAINT_HEIGHT);
  return {
    x: Math.min(PAINT_WIDTH - 1, Math.max(0, x)),
    y: Math.min(PAINT_HEIGHT - 1, Math.max(0, y)),
  };
}

/* ------------------------------------------------------- packing & undo ---- */

/**
 * Eight pixels to the byte, which is what "1-bit" actually means. A whole
 * 320×200 document is 8,000 bytes, so the 24-deep undo stack costs under
 * 200 KB and the autosave fits in localStorage with room to spare — no
 * resolution-halving budget needed.
 */
export function packBits(bmp: Bitmap): Uint8Array {
  const out = new Uint8Array(Math.ceil(bmp.length / 8));
  for (let i = 0; i < bmp.length; i += 1) {
    if (bmp[i] === 1) out[i >> 3] |= 128 >> (i & 7);
  }
  return out;
}

export function unpackBits(bytes: Uint8Array): Bitmap {
  const bmp = createBitmap();
  const limit = Math.min(bmp.length, bytes.length * 8);
  for (let i = 0; i < limit; i += 1) {
    bmp[i] = (bytes[i >> 3] >> (7 - (i & 7))) & 1;
  }
  return bmp;
}

/** Chunked so a 8 KB buffer never becomes 8,000 function arguments. */
function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 1024) {
    s += String.fromCharCode(...bytes.subarray(i, i + 1024));
  }
  return btoa(s);
}

function base64ToBytes(text: string): Uint8Array {
  const raw = atob(text);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export function encodeBitmap(bmp: Bitmap): string {
  return bytesToBase64(packBits(bmp));
}

/** Returns null for anything unreadable, so a corrupt autosave opens blank. */
export function decodeBitmap(text: string): Bitmap | null {
  try {
    return unpackBits(base64ToBytes(text));
  } catch {
    return null;
  }
}

/** Matches the colour OS's Paint. Deep enough to recover from a bad fill. */
export const UNDO_LIMIT = 24;

export interface UndoStack {
  readonly frames: readonly Uint8Array[];
}

export const EMPTY_UNDO: UndoStack = { frames: [] };

export function pushFrame(stack: UndoStack, bmp: Bitmap): UndoStack {
  const frames = [...stack.frames, packBits(bmp)];
  return { frames: frames.slice(-UNDO_LIMIT) };
}

export function popFrame(stack: UndoStack): { stack: UndoStack; bitmap: Bitmap } | null {
  const last = stack.frames[stack.frames.length - 1];
  if (!last) return null;
  return { stack: { frames: stack.frames.slice(0, -1) }, bitmap: unpackBits(last) };
}
