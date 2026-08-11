#!/usr/bin/env node
/**
 * Generates every placeholder asset in /public/images.
 *
 * Run with: npm run placeholders
 *
 * Everything it writes is meant to be REPLACED. Drop your own file in with the
 * same name and it is picked up automatically — see content/images.ts.
 *
 * PNGs are encoded by hand (zlib + CRC32) so this has no dependencies.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMG = join(ROOT, 'public', 'images');

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

/**
 * Encode RGBA pixels to a PNG buffer.
 * @param {number} w @param {number} h @param {Uint8Array} rgba length w*h*4
 */
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // 10,11,12 = compression, filter, interlace — all 0

  // Each scanline is prefixed with filter type 0 (None).
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
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
  console.log('  ✓', relPath);
}

const hex = (s) => [
  parseInt(s.slice(1, 3), 16),
  parseInt(s.slice(3, 5), 16),
  parseInt(s.slice(5, 7), 16),
  255,
];

/* ──────────────────────────────────────────────────── self-portrait (PNG) ── */

/**
 * A 32x32 pixel-art bust, upscaled 8x with nearest-neighbour so it stays crisp.
 * '.' transparent, 'o' outline, 's' skin, 'h' hair, 'c' clothing, 'e' eye/mouth.
 */
const PORTRAIT = [
  '................................',
  '................................',
  '..........oooooooooooo..........',
  '........oohhhhhhhhhhhhoo........',
  '.......ohhhhhhhhhhhhhhhho.......',
  '......ohhhhhhhhhhhhhhhhhho......',
  '......ohhhhhhhhhhhhhhhhhho......',
  '......ohhssssssssssssssho.......',
  '......ohsssssssssssssssho.......',
  '......ossssssssssssssssso.......',
  '......osssseessssseessssso......',
  '......osssseessssseessssso......',
  '......ossssssssssssssssso.......',
  '......osssssssseessssssso.......',
  '.......osssssssssssssso.........',
  '.......osssseeeeeeessso.........',
  '........ossssseeeeessso.........',
  '.........ossssssssssso..........',
  '..........ooosssssooo...........',
  '............ossssso.............',
  '...........occcccco.............',
  '.........occcccccccco...........',
  '........occcccccccccco..........',
  '.......occccccccccccccо.........',
  '......occccccccccccccccо........',
  '.....occcccccccccccccccco.......',
  '.....occcccccccccccccccco.......',
  '.....occcccccccccccccccco.......',
  '.....occcccccccccccccccco.......',
  '.....occcccccccccccccccco.......',
  '.....occcccccccccccccccco.......',
  '.....occcccccccccccccccco.......',
];

function buildPortrait() {
  const SCALE = 8;
  const S = 32 * SCALE;
  const palette = {
    o: hex('#1b1b1b'),
    h: hex('#4a3728'),
    s: hex('#e8bb95'),
    e: hex('#1b1b1b'),
    c: hex('#3572a5'),
    '.': [0, 0, 0, 0],
  };
  const px = raster(S, S, (x, y) => {
    const row = PORTRAIT[Math.floor(y / SCALE)] ?? '';
    const ch = row[Math.floor(x / SCALE)] ?? '.';
    return palette[ch] ?? palette['.'];
  });
  write('portrait/self-portrait-placeholder.png', encodePng(S, S, px));
}

/* ─────────────────────────────────────────────── project screenshots (PNG) ── */

const SHOT_TINTS = [
  '#3572a5', '#e3690b', '#1f8a3c', '#7b3fb8', '#c8202a', '#2b3fd8',
];

function buildScreenshots() {
  const W = 320;
  const H = 200;
  SHOT_TINTS.forEach((tint, i) => {
    const base = hex(tint);
    const px = raster(W, H, (x, y) => {
      // Title bar strip.
      if (y < 18) return hex('#dcdcdc');
      if (y === 18) return hex('#000000');
      // Diagonal hatch over a tinted field, so each placeholder is visibly distinct.
      const hatch = (x + y) % 16 < 2;
      const checker = Math.floor(x / 40) % 2 === Math.floor(y / 40) % 2;
      const shade = checker ? 1 : 0.86;
      if (hatch) return [255, 255, 255, 40];
      return [
        Math.round(base[0] * shade),
        Math.round(base[1] * shade),
        Math.round(base[2] * shade),
        255,
      ];
    });
    write(`projects/project-0${i + 1}-screenshot.png`, encodePng(W, H, px));
  });
}

/* ─────────────────────────────────────────────────────────── icons (SVG) ── */

const svg = (inner, size = 32) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" shape-rendering="crispEdges">${inner}</svg>`;

/** A generic document/app tile with a coloured face and a glyph. */
function iconTile(fill, glyph, glyphColor = '#ffffff') {
  return svg(
    `<rect x="3" y="2" width="26" height="28" fill="#ffffff" stroke="#000" stroke-width="1"/>` +
      `<rect x="4" y="3" width="24" height="8" fill="${fill}"/>` +
      `<text x="16" y="24" font-family="monospace" font-size="13" font-weight="bold" text-anchor="middle" fill="${fill}">${glyph}</text>` +
      `<rect x="4" y="3" width="24" height="8" fill="none"/>` +
      `<text x="16" y="10" font-family="monospace" font-size="7" text-anchor="middle" fill="${glyphColor}">•••</text>`,
  );
}

const ICONS = {
  'browser.svg': iconTile('#2b3fd8', '🌐'),
  'paint.svg': iconTile('#e3690b', '✏'),
  'notes.svg': iconTile('#e0a021', '≡'),
  'word.svg': iconTile('#2b3fd8', 'W'),
  'spreadsheet.svg': iconTile('#1f8a3c', '#'),
  'terminal.svg': svg(
    `<rect x="3" y="4" width="26" height="24" fill="#101010" stroke="#000"/>` +
      `<text x="7" y="18" font-family="monospace" font-size="10" fill="#33ff66">&gt;_</text>`,
  ),
  'factsweeper.svg': svg(
    `<rect x="3" y="3" width="26" height="26" fill="#dcdcdc" stroke="#000"/>` +
      `<g fill="#8f8f8f" stroke="#000" stroke-width="0.5">` +
      [0, 1, 2].
        flatMap((r) => [0, 1, 2].map((c) => `<rect x="${5 + c * 8}" y="${5 + r * 8}" width="7" height="7"/>`)).
        join('') +
      `</g><circle cx="16" cy="16" r="3" fill="#c8202a"/>`,
  ),
  'snake.svg': svg(
    `<rect x="3" y="3" width="26" height="26" fill="#101010" stroke="#000"/>` +
      `<g fill="#33ff66"><rect x="7" y="14" width="5" height="5"/><rect x="12" y="14" width="5" height="5"/><rect x="17" y="14" width="5" height="5"/><rect x="17" y="9" width="5" height="5"/></g>` +
      `<rect x="22" y="20" width="4" height="4" fill="#c8202a"/>`,
  ),
  '2048.svg': svg(
    `<rect x="3" y="3" width="26" height="26" fill="#e0a021" stroke="#000"/>` +
      `<text x="16" y="21" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle" fill="#ffffff">2048</text>`,
  ),
  'about.svg': iconTile('#7b3fb8', 'i'),
  'project.svg': iconTile('#4a4a4a', '{}'),
  'project-python.svg': iconTile('#3572a5', 'py'),
  'project-web.svg': iconTile('#e3690b', '&lt;/&gt;'),
};

/* ────────────────────────────────────────────────────────── system (SVG) ── */

const LOGO = svg(
  // A rainbow-striped apple-ish mark — deliberately generic, swap for your own.
  `<g stroke="none">` +
    `<rect x="6" y="4"  width="20" height="4" fill="#1f8a3c"/>` +
    `<rect x="6" y="8"  width="20" height="4" fill="#e0a021"/>` +
    `<rect x="6" y="12" width="20" height="4" fill="#e3690b"/>` +
    `<rect x="6" y="16" width="20" height="4" fill="#c8202a"/>` +
    `<rect x="6" y="20" width="20" height="4" fill="#7b3fb8"/>` +
    `<rect x="6" y="24" width="20" height="4" fill="#2b3fd8"/>` +
    `</g>` +
    `<rect x="6" y="4" width="20" height="24" fill="none" stroke="#000" stroke-width="1"/>`,
);

const HAPPY_MAC = svg(
  `<rect x="4" y="3" width="24" height="24" rx="2" fill="#dcdcdc" stroke="#000"/>` +
    `<rect x="7" y="6" width="18" height="14" fill="#ffffff" stroke="#000"/>` +
    `<circle cx="12" cy="11" r="1.4" fill="#000"/><circle cx="20" cy="11" r="1.4" fill="#000"/>` +
    `<path d="M11 15 q5 4 10 0" fill="none" stroke="#000" stroke-width="1.4"/>` +
    `<rect x="9" y="22" width="14" height="2" fill="#8f8f8f"/>`,
);

// Desktop pattern: the classic 50% dither, as a 4x4 tile.
const PATTERN = `<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4" viewBox="0 0 4 4" shape-rendering="crispEdges"><rect width="4" height="4" fill="#6a8ca8"/><rect x="0" y="0" width="2" height="2" fill="#5d7d97"/><rect x="2" y="2" width="2" height="2" fill="#5d7d97"/></svg>`;

/* ────────────────────────────────────────────────────────────────── main ── */

console.log('Generating placeholder assets into public/images …');

for (const [name, content] of Object.entries(ICONS)) {
  write(`icons/${name}`, Buffer.from(content, 'utf8'));
}
write('desktop/logo.svg', Buffer.from(LOGO, 'utf8'));
write('desktop/happy-mac.svg', Buffer.from(HAPPY_MAC, 'utf8'));
write('desktop/pattern.svg', Buffer.from(PATTERN, 'utf8'));

buildPortrait();
buildScreenshots();

write(
  'README.md',
  Buffer.from(
    `# Placeholder images

Every file in here is generated by \`npm run placeholders\` and is meant to be replaced.

To swap one in: drop your file here with the SAME filename. Nothing else to change.
Paths are declared once in \`content/images.ts\` if you'd rather rename things.

| Folder | What goes here |
| --- | --- |
| \`portrait/\` | \`self-portrait-placeholder.png\` — preloaded into the Paint app. A pixel-art bust reads best. |
| \`projects/\` | \`project-0N-screenshot.png\` — one per project, referenced from \`content/projects.ts\`. |
| \`icons/\` | One icon per app, 32x32. SVG or PNG both fine. |
| \`desktop/\` | \`logo.svg\` (menu-bar mark), \`happy-mac.svg\` (boot screen), \`pattern.svg\` (tiled wallpaper). |
`,
    'utf8',
  ),
);

console.log('Done.');
