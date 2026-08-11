/**
 * Four original 1-bit pictures for the Scrapbook, computed rather than drawn.
 *
 * OWNER: Classic Boot agent.
 *
 * Everything here is ordered (Bayer) dithering — the technique a 1984 bitmap
 * display used to fake continuous tone, and the reason a MacPaint gradient
 * looks the way it does. Generating them keeps the file small, keeps them
 * deterministic (so server and client render identically), and guarantees no
 * pixel is anything but black or white.
 */
import type { PixelMap } from '@/components/classic/icons';

const ART_SIZE = 56;

/** The classic 4×4 ordered-dither threshold matrix. */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/**
 * Render a tone function to a pixel map. `tone` returns 0 (paper) … 1 (ink);
 * the Bayer matrix decides which pixels tip over.
 */
function dither(
  size: number,
  tone: (x: number, y: number) => number,
): PixelMap {
  const rows: string[] = [];
  for (let y = 0; y < size; y += 1) {
    let row = '';
    for (let x = 0; x < size; x += 1) {
      const threshold = (BAYER[y % 4][x % 4] + 0.5) / 16;
      row += tone(x, y) > threshold ? '#' : '.';
    }
    rows.push(row);
  }
  return rows;
}

/** A left-to-right tone ramp — the "does this display even work" test image. */
const RAMP = dither(ART_SIZE, (x) => x / (ART_SIZE - 1));

/** A lit sphere. Lambert shading, hard edge, no anti-aliasing anywhere. */
const SPHERE = dither(ART_SIZE, (x, y) => {
  const cx = (x - ART_SIZE / 2 + 0.5) / (ART_SIZE / 2 - 2);
  const cy = (y - ART_SIZE / 2 + 0.5) / (ART_SIZE / 2 - 2);
  const r2 = cx * cx + cy * cy;
  if (r2 > 1) return 0;
  const nz = Math.sqrt(1 - r2);
  // Light from the upper left, the way every 1984 icon was lit.
  const lambert = (-cx * 0.5 + -cy * 0.55 + nz * 0.67) / 1.0;
  const lit = Math.max(0, Math.min(1, lambert));
  return 1 - lit * 0.95;
});

/** Concentric rings — a moiré test card, and it still reads as a target. */
const RINGS = dither(ART_SIZE, (x, y) => {
  const cx = x - ART_SIZE / 2 + 0.5;
  const cy = y - ART_SIZE / 2 + 0.5;
  const d = Math.sqrt(cx * cx + cy * cy);
  if (d > ART_SIZE / 2 - 1) return 0;
  return (Math.cos(d * 0.75) + 1) / 2;
});

/** An over-under basket weave, drawn in hard blacks with dithered shadow. */
const WEAVE = dither(ART_SIZE, (x, y) => {
  const bx = Math.floor(x / 7) % 2;
  const by = Math.floor(y / 7) % 2;
  const inX = x % 7 < 6;
  const inY = y % 7 < 6;
  if (!inX || !inY) return 1;
  return bx === by ? 0.25 : 0.75;
});

export interface ScrapbookPage {
  title: string;
  map: PixelMap;
}

export const SCRAPBOOK_PAGES: readonly ScrapbookPage[] = [
  { title: 'Tone Ramp', map: RAMP },
  { title: 'Sphere', map: SPHERE },
  { title: 'Rings', map: RINGS },
  { title: 'Weave', map: WEAVE },
] as const;
