/**
 * 1-bit dither patterns for the 1984 classic shell.
 *
 * OWNER: Classic Boot agent.
 *
 * The classic screen is pure black and white — no grays, no alpha, no
 * gradients. Anything that needs to *read* as gray is a checkerboard of black
 * pixels on white, exactly like a 1984 bitmap display. These are tiny SVG
 * tiles rather than CSS gradients because gradients get anti-aliased by the
 * browser, which puts real gray pixels on screen and breaks the illusion.
 */
import type { CSSProperties } from 'react';

/** Wrap a bitmap tile as a CSS url() with hard pixel edges. */
function tile(size: number, inner: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `shape-rendering="crispEdges">${inner}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** A rect in tile coordinates. */
function px(x: number, y: number, fill = '#000', w = 1, h = 1): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
}

export interface DitherPattern {
  id: string;
  /** Shown in the Control Panel's pattern picker. */
  label: string;
  /** Edge length of the repeating tile, in device-independent px. */
  size: number;
  /** Ready-made CSS `background-image` value. */
  image: string;
}

/** 50% checkerboard — the workhorse "gray" of a 1-bit display. */
const CHECKER_50 = tile(2, px(0, 0) + px(1, 1));
/** The same checkerboard drawn in white, for laying *over* black. */
const CHECKER_50_WHITE = tile(2, px(0, 0, '#fff') + px(1, 1, '#fff'));
/** 25% — sparse dots, reads as light gray. */
const CHECKER_25 = tile(4, px(0, 0) + px(2, 2));
/** 12.5% — barely there. */
const CHECKER_12 = tile(4, px(1, 1));

export const PATTERNS: readonly DitherPattern[] = [
  { id: 'white', label: 'Paper', size: 2, image: 'none' },
  { id: 'dots-12', label: 'Dots', size: 4, image: CHECKER_12 },
  { id: 'dots-25', label: 'Sand', size: 4, image: CHECKER_25 },
  { id: 'checker', label: 'Gray', size: 2, image: CHECKER_50 },
  {
    id: 'weave',
    label: 'Weave',
    size: 4,
    image: tile(4, px(0, 0, '#000', 4, 1) + px(0, 2) + px(2, 2)),
  },
  {
    id: 'rules',
    label: 'Rules',
    size: 4,
    image: tile(4, px(0, 0, '#000', 4, 1)),
  },
  {
    id: 'grid',
    label: 'Grid',
    size: 8,
    image: tile(8, px(0, 0, '#000', 8, 1) + px(0, 0, '#000', 1, 8)),
  },
  {
    id: 'twill',
    label: 'Twill',
    size: 4,
    image: tile(4, px(0, 0) + px(1, 1) + px(2, 2) + px(3, 3)),
  },
] as const;

/** The desktop pattern the machine starts up with. */
export const DEFAULT_PATTERN = 3;

/** Background style for a pattern index, clamped so bad input can't blank out. */
export function patternStyle(index: number): CSSProperties {
  const p = PATTERNS[index] ?? PATTERNS[DEFAULT_PATTERN];
  if (p.image === 'none') return { backgroundColor: '#fff' };
  return {
    backgroundColor: '#fff',
    backgroundImage: p.image,
    backgroundSize: `${p.size}px ${p.size}px`,
    backgroundRepeat: 'repeat',
  };
}

/** 50% white checker, laid over black text/fills to fake a disabled gray. */
export const WHITE_DITHER_STYLE: CSSProperties = {
  backgroundImage: CHECKER_50_WHITE,
  backgroundSize: '2px 2px',
  backgroundRepeat: 'repeat',
};

/** 50% black checker, for shading a white surface. */
export const BLACK_DITHER_STYLE: CSSProperties = {
  backgroundImage: CHECKER_50,
  backgroundSize: '2px 2px',
  backgroundRepeat: 'repeat',
};
