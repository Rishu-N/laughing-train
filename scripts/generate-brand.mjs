#!/usr/bin/env node
/**
 * Generates the Phase 3 brand assets:
 *
 *   public/images/brand/classic-mark.svg        1-bit boot glyph (classic shell)
 *   public/images/brand/rishu-inc.svg           "Rishu Inc" pixel wordmark
 *   public/images/brand/classic-portrait.png    32x32 pure 1-bit bust
 *   public/images/brand/classic-portrait@4x.png 128x128, nearest-neighbour
 *   public/images/desktop/logo.svg              colour-OS menu-bar monogram (16px)
 *   public/images/desktop/boot-mark.svg         colour-OS boot mark (96px)
 *
 * Run with: node scripts/generate-brand.mjs
 * Set PREVIEW_DIR=/some/dir to also dump 8x PNG previews of every grid, which is
 * the only honest way to check that a 32x32 bitmap actually reads as something.
 *
 * ── TRADEMARK NOTE ─────────────────────────────────────────────────────────
 * Everything here is an ORIGINAL drawing. Nothing in this file reproduces an
 * Apple trademark or artwork: no bitten apple, no rainbow logo, no Happy Mac
 * smiling computer, no recreation of Susan Kare's bitmaps. The shared language
 * is only the *technique* of 1984 — 1-bit pixels, chunky letterforms, 50%
 * dither for tone — which is a medium, not a mark.
 *
 * Everything is drawn on an integer pixel grid and emitted as merged <rect>
 * runs with shape-rendering="crispEdges", so the marks stay hard-edged at every
 * size. PNGs are encoded by hand (zlib + CRC32) so this has no dependencies.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMG = join(ROOT, 'public', 'images');
const PREVIEW_DIR = process.env.PREVIEW_DIR ?? '';

/* ───────────────────────────────────────────────────────────── PNG encoder ── */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Encode RGBA pixels (length w*h*4) to a PNG buffer. */
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA

  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: None
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(
      raw,
      y * (w * 4 + 1) + 1,
    );
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Build an RGBA buffer by calling fn(x, y) -> [r,g,b,a]. */
function raster(w, h, fn) {
  const px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = fn(x, y);
      const i = (y * w + x) * 4;
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = a ?? 255;
    }
  }
  return px;
}

function write(relPath, buf) {
  const full = join(IMG, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, buf);
  console.log('  ✓', relPath, `(${buf.length} B)`);
}

/* ────────────────────────────────────────────────────────── grid plumbing ── */

/**
 * A "grid" is an array of equal-length strings, one char per pixel. Palettes map
 * a char to a CSS colour, or to null for transparent.
 *
 * '.' transparent · '#' black · 'w' white · 'd' 50% dither · 'a' accent
 */
const BLACK = '#000000';
const WHITE = '#ffffff';
const ACCENT = '#2b3fd8';
const ACCENT_DEEP = '#1d2a99';

const BW = { '.': null, '#': BLACK, w: WHITE };

/** Expand every 'd' into the classic 50% checkerboard, in place-ish. */
function resolveDither(rows, on = '#', off = 'w') {
  return rows.map((row, y) =>
    row
      .split('')
      .map((ch, x) => (ch === 'd' ? ((x + y) % 2 === 0 ? on : off) : ch))
      .join(''),
  );
}

function assertRect(rows, w, h, name) {
  if (rows.length !== h) throw new Error(`${name}: expected ${h} rows, got ${rows.length}`);
  rows.forEach((r, i) => {
    if (r.length !== w) throw new Error(`${name}: row ${i} is ${r.length} wide, expected ${w}`);
  });
}

/**
 * Emit an SVG whose pixels are merged horizontal runs. Integer coordinates plus
 * crispEdges means it renders identically to a bitmap at any scale.
 */
function gridToSvg(rows, palette, { width, height } = {}) {
  const w = rows[0].length;
  const h = rows.length;
  const parts = [];
  for (let y = 0; y < h; ) {
    // Identical consecutive rows collapse into one band of rects.
    let band = 1;
    while (y + band < h && rows[y + band] === rows[y]) band++;
    let x = 0;
    while (x < w) {
      const ch = rows[y][x];
      let run = 1;
      while (x + run < w && rows[y][x + run] === ch) run++;
      const fill = palette[ch];
      if (fill) {
        parts.push(
          `<rect x="${x}" y="${y}" width="${run}" height="${band}" fill="${fill}"/>`,
        );
      }
      x += run;
    }
    y += band;
  }
  const attrs = [
    'xmlns="http://www.w3.org/2000/svg"',
    `width="${width ?? w}"`,
    `height="${height ?? h}"`,
    `viewBox="0 0 ${w} ${h}"`,
    'shape-rendering="crispEdges"',
  ].join(' ');
  return `<svg ${attrs}>${parts.join('')}</svg>`;
}

/** Same grid, rasterised to a PNG at an integer scale (nearest neighbour). */
function gridToPng(rows, palette, scale = 1) {
  const w = rows[0].length;
  const h = rows.length;
  const rgba = {};
  for (const [ch, col] of Object.entries(palette)) {
    rgba[ch] = col
      ? [
          parseInt(col.slice(1, 3), 16),
          parseInt(col.slice(3, 5), 16),
          parseInt(col.slice(5, 7), 16),
          255,
        ]
      : [0, 0, 0, 0];
  }
  const px = raster(w * scale, h * scale, (x, y) => {
    const ch = rows[Math.floor(y / scale)][Math.floor(x / scale)];
    return rgba[ch] ?? [0, 0, 0, 0];
  });
  return encodePng(w * scale, h * scale, px);
}

/** Dump a grid to the terminal so it can be eyeballed while iterating. */
function show(name, rows) {
  const glyphs = { '.': ' ', '#': '█', w: '·', d: '▒', a: '▓', A: '▒' };
  console.log(`\n${name} — ${rows[0].length}x${rows.length}`);
  console.log('   +' + '-'.repeat(rows[0].length) + '+');
  rows.forEach((r, i) => {
    console.log(
      String(i).padStart(2, ' ') + ' |' + r.split('').map((c) => glyphs[c] ?? c).join('') + '|',
    );
  });
  console.log('   +' + '-'.repeat(rows[0].length) + '+');
}

function preview(name, rows, palette, scale = 8) {
  if (!PREVIEW_DIR) return;
  mkdirSync(PREVIEW_DIR, { recursive: true });
  // Previews get an opaque white ground so transparency is not mistaken for ink.
  const solid = { ...palette };
  const flat = rows.map((r) => r.split('').map((c) => (palette[c] ? c : '_')).join(''));
  solid._ = '#f2f2f2';
  writeFileSync(join(PREVIEW_DIR, `${name}.png`), gridToPng(flat, solid, scale));
}

/* ═══════════════════════════════════════════════════ 1. classic-mark.svg ══ */

/** Which cells of an NxN grid belong to the plate: a square with cut corners. */
function plateMask(N, cut) {
  const mask = [];
  for (let y = 0; y < N; y++) {
    const row = [];
    for (let x = 0; x < N; x++) {
      row.push(Math.min(x, N - 1 - x) + Math.min(y, N - 1 - y) >= cut);
    }
    mask.push(row);
  }
  return mask;
}

/**
 * 4-connected distance from outside the mask: 1 on the outermost ring of the
 * shape, 2 on the next ring in, and so on. Lets rules be inset by a exact
 * number of pixels and still follow the cut corners.
 */
function insetDistance(mask) {
  const h = mask.length;
  const w = mask[0].length;
  const dist = mask.map((r) => r.map((on) => (on ? Infinity : 0)));
  const queue = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y][x]) continue;
      const outside = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ].some(([nx, ny]) => nx < 0 || ny < 0 || nx >= w || ny >= h || !mask[ny][nx]);
      if (outside) {
        dist[y][x] = 1;
        queue.push([x, y]);
      }
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (dist[ny][nx] !== Infinity) continue;
      dist[ny][nx] = dist[y][x] + 1;
      queue.push([nx, ny]);
    }
  }
  return dist;
}

/** An astroid: |dx|^p + |dy|^p <= t with p < 1 → concave-sided four-point star. */
function sparkTest(N, p, reach) {
  const c = (N - 1) / 2;
  const thresh = Math.pow(reach, p) + Math.pow(0.5, p);
  return (x, y) =>
    Math.pow(Math.abs(x - c), p) + Math.pow(Math.abs(y - c), p) <= thresh;
}

/**
 * "Ignition" — a four-point spark struck inside a double-ruled plate with cut
 * corners. The spark is an astroid quantised onto the pixel grid, so its sides
 * are concave and its points land on exact pixel columns; the double rule and
 * the clipped corners are the language of a stamped machine plate, which is
 * what a 1984 boot screen was announcing.
 *
 * Original shape. It is not derived from, and does not resemble, any existing
 * logo — least of all Apple's.
 */
function buildClassicMark() {
  const N = 32;
  const mask = plateMask(N, 3);
  const dist = insetDistance(mask);
  const inSpark = sparkTest(N, 0.4, 11);

  const rows = [];
  for (let y = 0; y < N; y++) {
    let row = '';
    for (let x = 0; x < N; x++) {
      if (!mask[y][x]) row += '.';
      else if (dist[y][x] === 1 || dist[y][x] === 3) row += '#'; // double rule
      else if (inSpark(x, y)) row += '#';
      else row += 'w';
    }
    rows.push(row);
  }
  assertRect(rows, N, N, 'classic-mark');
  return rows;
}

/* ═══════════════════════════════════════════════════ 2. rishu-inc.svg ═════ */

/**
 * A 5x7 pixel alphabet, hand-drawn. Only the letters the wordmark needs exist.
 * Drawn as geometry, never as <text>, so no font has to be present.
 */
const FONT = {
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  N: ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
};

/** Blit a glyph into a mutable grid of char arrays. */
function blit(grid, glyph, x0, y0, ink, scale = 1) {
  glyph.forEach((line, gy) => {
    line.split('').forEach((ch, gx) => {
      if (ch !== '#') return;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const y = y0 + gy * scale + sy;
          const x = x0 + gx * scale + sx;
          if (grid[y] && grid[y][x] !== undefined) grid[y][x] = ink;
        }
      }
    });
  });
}

function blitWord(grid, word, x0, y0, ink, scale = 1, tracking = 1) {
  let x = x0;
  for (const letter of word) {
    blit(grid, FONT[letter], x, y0, ink, scale);
    x += (5 + tracking) * scale;
  }
  return x - tracking * scale; // right edge of the last glyph
}

function fill(grid, x0, y0, w, h, ink) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (grid[y] && grid[y][x] !== undefined) grid[y][x] = ink;
    }
  }
}

/**
 * "RISHU" in bare pixel caps, followed by "INC" reversed out of a solid slug —
 * the nameplate convention stamped on the back of 80s hardware. Drawn 1-bit so
 * the transition can colourise it; the slug keeps it from reading as plain text.
 */
function buildWordmark() {
  const W = 57;
  const H = 13;
  const grid = Array.from({ length: H }, () => Array(W).fill('.'));

  // RISHU: 5 glyphs x 5px + 4 x 1px tracking = 29px, at x=1..29, y=3..9.
  blitWord(grid, 'RISHU', 1, 3, '#', 1, 1);

  // Underscore rule beneath the word — ties the two halves into one lockup.
  fill(grid, 1, 11, 29, 1, '#');

  // INC slug: full-height black plate, letters knocked out in white.
  fill(grid, 32, 0, 25, H, '#');
  blitWord(grid, 'INC', 36, 3, 'w', 1, 1);

  const rows = grid.map((r) => r.join(''));
  assertRect(rows, W, H, 'rishu-inc');
  return rows;
}

/* ═══════════════════════════════════════════════════ 3. logo.svg (16px) ═══ */

/**
 * The colour-OS menu-bar monogram, drawn on a 16x16 grid because 16px is the
 * size it actually renders at — one grid cell, one device pixel.
 *
 * Same R skeleton as the wordmark, thickened to 2px strokes so the counters
 * survive at 16px, reversed out of a solid accent tile. The tile matters: the
 * menu-bar button flips to solid black while its menu is open, and a tile keeps
 * the mark visible against both that and the light chrome.
 */
const LOGO_R = [
  '######..',
  '##...##.',
  '##...##.',
  '##...##.',
  '######..',
  '##.##...',
  '##..##..',
  '##...##.',
  '##...##.',
  '##....##',
];

function buildLogo() {
  const N = 16;
  const mask = plateMask(N, 1); // clip the four corner pixels — same plate shape
  const dist = insetDistance(mask);
  const grid = [];
  for (let y = 0; y < N; y++) {
    const row = [];
    for (let x = 0; x < N; x++) {
      if (!mask[y][x]) row.push('.');
      else if (dist[y][x] === 1) row.push('#'); // black keyline
      else row.push('a');
    }
    grid.push(row);
  }
  blit(grid, LOGO_R, 4, 3, 'w', 1);
  const rows = grid.map((r) => r.join(''));
  assertRect(rows, N, N, 'logo');
  return rows;
}

/* ═══════════════════════════════════════════════ 4. boot-mark.svg (96px) ══ */

/**
 * The colour-OS boot mark: the same plate and the same monogram as the menu-bar
 * logo, at 2x on a 32x32 grid, with a hard offset shadow under the R. The
 * shadow is the one concession to the colour era — the classic shell has no
 * such thing, because 1-bit could not afford one.
 */
function buildBootMark() {
  const N = 32;
  const mask = plateMask(N, 3);
  const dist = insetDistance(mask);

  const grid = [];
  for (let y = 0; y < N; y++) {
    const row = [];
    for (let x = 0; x < N; x++) {
      if (!mask[y][x]) row.push('.');
      else if (dist[y][x] === 1) row.push('#'); // black keyline
      else if (dist[y][x] === 2) row.push('A'); // deep-accent inner bevel
      else row.push('a');
    }
    grid.push(row);
  }
  blit(grid, LOGO_R, 10, 8, 'A', 2); // offset shadow
  blit(grid, LOGO_R, 8, 6, 'w', 2);

  const rows = grid.map((r) => r.join(''));
  assertRect(rows, N, N, 'boot-mark');
  return rows;
}

/* ═══════════════════════════════════════════ 5. classic-portrait.png ══════ */

/**
 * A 32x32 bust in the proportions of a classic desk-accessory icon: black
 * outline, white face, solid hair, 50% dither for the shirt because 1-bit has
 * no other way to say "grey".
 *
 * PLACEHOLDER: it is deliberately a generic stylised person, not a likeness of
 * the site's owner. Swap the map below when a real face is available.
 *
 * '.' transparent · '#' black · 'w' white · 'd' 50% dither
 */
const PORTRAIT = [
  '................................', //  0
  '................................', //  1
  '............########............', //  2
  '..........############..........', //  3
  '.........##############.........', //  4
  '.........##############.........', //  5
  '.........##############.........', //  6
  '.........##wwwwwwwwww##.........', //  7
  '.........##wwwwwwwwww##.........', //  8
  '.........#wwwwwwwwwwww#.........', //  9
  '........##wwwwwwwwwwww##........', // 10
  '........##ww##wwww##ww##........', // 11  eyes
  '........##wwwwwwwwwwww##........', // 12
  '.........#wwwww##wwwww#.........', // 13  nose
  '.........#wwww####wwww#.........', // 14
  '..........#wwwwwwwwww#..........', // 15
  '..........#wwwwwwwwww#..........', // 16
  '...........#ww####ww#...........', // 17  mouth
  '............#wwwwww#............', // 18
  '.............######.............', // 19  jaw
  '.............#wwww#.............', // 20  neck
  '.........#ddd#wwww#ddd#.........', // 21  collar
  '.......#dddddd#ww#dddddd#.......', // 22
  '......#dddddddd##dddddddd#......', // 23
  '.....#dddddddddddddddddddd#.....', // 24
  '....#dddddddddddddddddddddd#....', // 25
  '....#dddddddddddddddddddddd#....', // 26
  '....#dddddddddddddddddddddd#....', // 27
  '....#dddddddddddddddddddddd#....', // 28
  '....#dddddddddddddddddddddd#....', // 29
  '....#dddddddddddddddddddddd#....', // 30
  '....########################....', // 31
];

function buildPortrait() {
  assertRect(PORTRAIT, 32, 32, 'classic-portrait');
  const rows = resolveDither(PORTRAIT);
  assertOneBit(rows, BW, 'classic-portrait');
  return rows;
}

/**
 * Guard the "genuinely 1-bit" promise: every pixel must end up pure black, pure
 * white, or fully transparent. No greys, no partial alpha, ever.
 */
function assertOneBit(rows, palette, name) {
  const seen = new Set(rows.join('').split(''));
  for (const ch of seen) {
    if (!(ch in palette)) throw new Error(`${name}: char "${ch}" is not in the palette`);
    const col = palette[ch];
    if (col !== null && col !== BLACK && col !== WHITE) {
      throw new Error(`${name}: char "${ch}" maps to ${col}, which is not 1-bit`);
    }
  }
}

/* ────────────────────────────────────────────────────────────────── main ── */

console.log('Generating brand assets into public/images …');

const classicMark = buildClassicMark();
const wordmark = buildWordmark();
const logo = buildLogo();
const bootMark = buildBootMark();
const portrait = buildPortrait();

// The classic-shell assets are held to the 1-bit rule; the colour-OS ones are not.
assertOneBit(classicMark, BW, 'classic-mark');
assertOneBit(wordmark, BW, 'rishu-inc');

const COLOUR = { '.': null, '#': BLACK, w: WHITE, a: ACCENT, A: ACCENT_DEEP };

write('brand/classic-mark.svg', Buffer.from(gridToSvg(classicMark, BW, { width: 96, height: 96 }), 'utf8'));
write('brand/rishu-inc.svg', Buffer.from(gridToSvg(wordmark, BW, { width: 228, height: 52 }), 'utf8'));
write('brand/classic-portrait.png', gridToPng(portrait, BW, 1));
write('brand/classic-portrait@4x.png', gridToPng(portrait, BW, 4));
write('desktop/logo.svg', Buffer.from(gridToSvg(logo, COLOUR, { width: 16, height: 16 }), 'utf8'));
write('desktop/boot-mark.svg', Buffer.from(gridToSvg(bootMark, COLOUR, { width: 96, height: 96 }), 'utf8'));

if (process.env.SHOW_GRIDS) {
  show('classic-mark', classicMark);
  show('rishu-inc', wordmark);
  show('logo', logo);
  show('boot-mark', bootMark);
  show('classic-portrait', portrait);
}

preview('classic-mark', classicMark, BW, 8);
preview('rishu-inc', wordmark, BW, 8);
preview('logo', logo, COLOUR, 16);
preview('boot-mark', bootMark, COLOUR, 8);
preview('classic-portrait', portrait, BW, 8);
preview('classic-portrait-1x', portrait, BW, 1);
if (PREVIEW_DIR) console.log('  previews →', PREVIEW_DIR);

console.log('Done.');
