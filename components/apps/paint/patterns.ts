/**
 * The Paint palette: classic 1-bit MacPaint tiles plus a few colour inks.
 *
 * Every swatch is an 8x8 one-bit tile plus an ink colour. A solid colour is just
 * a tile with every bit set, which means strokes, filled shapes and the paint
 * bucket all share one code path instead of branching on "is this a pattern".
 *
 * Ink colours are read from the OS design tokens at runtime rather than being
 * hardcoded, so the palette follows the theme. Canvas cannot consume `var(--x)`
 * directly, so we resolve each token once on mount.
 */

/** One 8x8 tile: eight rows, bit 7 = leftmost pixel. */
export type Tile = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export const TILE_SIZE = 8;

const SOLID: Tile = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
const CHECKER: Tile = [0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55];
const DOTS: Tile = [0x88, 0x00, 0x22, 0x00, 0x88, 0x00, 0x22, 0x00];
const SPARSE: Tile = [0x80, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00];
const HLINES: Tile = [0xff, 0x00, 0xff, 0x00, 0xff, 0x00, 0xff, 0x00];
const VLINES: Tile = [0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa];
const DIAGONAL: Tile = [0x88, 0x44, 0x22, 0x11, 0x88, 0x44, 0x22, 0x11];
const WEAVE: Tile = [0xff, 0x88, 0x88, 0x88, 0xff, 0x08, 0x08, 0x08];
const GRID: Tile = [0xff, 0x81, 0x81, 0x81, 0x81, 0x81, 0x81, 0x81];

export interface SwatchDef {
  id: string;
  label: string;
  /** CSS custom property holding the ink colour. */
  token: string;
  /** Used when the token is unavailable (SSR, or a stripped stylesheet). */
  fallback: string;
  tile: Tile;
}

/** Solid inks, in palette order. */
export const COLOUR_SWATCHES: SwatchDef[] = [
  { id: 'black', label: 'Black', token: '--color-os-ink', fallback: '#000000', tile: SOLID },
  { id: 'white', label: 'White', token: '--color-os-face', fallback: '#ffffff', tile: SOLID },
  { id: 'grey', label: 'Grey', token: '--color-os-chrome-dark', fallback: '#8f8f8f', tile: SOLID },
  { id: 'blue', label: 'Blue', token: '--color-os-accent', fallback: '#2b3fd8', tile: SOLID },
  { id: 'red', label: 'Red', token: '--color-os-alert', fallback: '#c8202a', tile: SOLID },
  { id: 'yellow', label: 'Yellow', token: '--color-os-warn', fallback: '#e0a021', tile: SOLID },
  { id: 'green', label: 'Green', token: '--color-os-ok', fallback: '#1f8a3c', tile: SOLID },
  { id: 'purple', label: 'Purple', token: '--color-os-icon-game', fallback: '#7b3fb8', tile: SOLID },
  { id: 'orange', label: 'Orange', token: '--color-os-icon-web', fallback: '#e3690b', tile: SOLID },
];

/** 1-bit dither tiles, always inked in black over white. */
export const PATTERN_SWATCHES: SwatchDef[] = [
  { id: 'checker', label: '50% dither', token: '--color-os-ink', fallback: '#000000', tile: CHECKER },
  { id: 'dots', label: '25% dots', token: '--color-os-ink', fallback: '#000000', tile: DOTS },
  { id: 'sparse', label: 'Sparse dots', token: '--color-os-ink', fallback: '#000000', tile: SPARSE },
  { id: 'hlines', label: 'Horizontal lines', token: '--color-os-ink', fallback: '#000000', tile: HLINES },
  { id: 'vlines', label: 'Vertical lines', token: '--color-os-ink', fallback: '#000000', tile: VLINES },
  { id: 'diagonal', label: 'Diagonal lines', token: '--color-os-ink', fallback: '#000000', tile: DIAGONAL },
  { id: 'weave', label: 'Brick', token: '--color-os-ink', fallback: '#000000', tile: WEAVE },
  { id: 'grid', label: 'Grid', token: '--color-os-ink', fallback: '#000000', tile: GRID },
];

export const ALL_SWATCHES: SwatchDef[] = [...COLOUR_SWATCHES, ...PATTERN_SWATCHES];

export interface ResolvedSwatch extends SwatchDef {
  /** The token resolved to a concrete CSS colour. */
  colour: string;
  rgb: [number, number, number];
  /** Small repeating canvas used for strokes, fills and the palette preview. */
  tileCanvas: HTMLCanvasElement;
  /** data: URL of the tile, for the swatch button background. */
  preview: string;
}

/** The colour painted where a tile bit is 0. Patterns are opaque, as on a Mac. */
export const TILE_BACKGROUND = '#ffffff';

function readToken(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value.length > 0 ? value : fallback;
}

/** Resolve any CSS colour string to rgb by asking the canvas to parse it. */
function colourToRgb(colour: string): [number, number, number] {
  const probe = document.createElement('canvas');
  probe.width = 1;
  probe.height = 1;
  const ctx = probe.getContext('2d');
  if (!ctx) return [0, 0, 0];
  ctx.fillStyle = '#000000';
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

function buildTileCanvas(tile: Tile, colour: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = TILE_SIZE;
  c.height = TILE_SIZE;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.fillStyle = TILE_BACKGROUND;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = colour;
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      if ((tile[y] >> (7 - x)) & 1) ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

/** Resolve the whole palette. Browser-only — call from an effect. */
export function resolvePalette(): ResolvedSwatch[] {
  return ALL_SWATCHES.map((def) => {
    const colour = readToken(def.token, def.fallback);
    const tileCanvas = buildTileCanvas(def.tile, colour);
    return {
      ...def,
      colour,
      rgb: colourToRgb(colour),
      tileCanvas,
      preview: tileCanvas.toDataURL(),
    };
  });
}

/** Ink or background colour of a swatch at a given canvas pixel. */
export function sampleSwatch(
  swatch: ResolvedSwatch,
  x: number,
  y: number,
): [number, number, number] {
  const bit = (swatch.tile[((y % TILE_SIZE) + TILE_SIZE) % TILE_SIZE] >> (7 - (((x % TILE_SIZE) + TILE_SIZE) % TILE_SIZE))) & 1;
  return bit ? swatch.rgb : [255, 255, 255];
}
