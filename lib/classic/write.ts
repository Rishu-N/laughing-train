/**
 * Ruler arithmetic, formatting model and text measurement for the 1984 word
 * processor. No JSX, no component imports.
 *
 * OWNER: Classic Boot agent.
 *
 * Everything here is in **points**, and a point is a pixel. That is not a
 * convenience: the machine being imitated shipped a 72 dpi screen precisely so
 * that a typographic point and a screen pixel were the same thing, which is why
 * a ruler drawn in inches could be drawn in pixels with no conversion at all.
 * So an inch is 72, a tick is an eighth of an inch, and the numbers on the
 * ruler are honest.
 */
import type { CSSProperties } from 'react';

/** Namespaced away from the colour OS's `word`, which is a different program. */
export const WRITE_SESSION_ID = 'classic-write';

export const POINTS_PER_INCH = 72;
/** Ruler graduation: an eighth of an inch. */
export const RULER_TICK = POINTS_PER_INCH / 8;
/** Where Tab lands when the ruler carries no explicit stop past the caret. */
export const DEFAULT_TAB_EVERY = POINTS_PER_INCH / 2;

/** Narrowest column the indent markers may squeeze the text into. */
const MIN_COLUMN = 48;

/* ---------------------------------------------------------------- ruler ---- */

export interface RulerState {
  /** Left margin of every line but the first, in points from the page edge. */
  leftIndent: number;
  /** Left margin of the first line of a paragraph. Can sit left of `left`. */
  firstLine: number;
  /** Right margin, measured from the page edge, not from the right. */
  rightIndent: number;
  /** Explicit tab stops, ascending. */
  tabs: readonly number[];
}

export type RulerMarker = 'left' | 'first' | 'right';

export const DEFAULT_RULER: RulerState = {
  leftIndent: 0,
  firstLine: 0,
  rightIndent: 6 * POINTS_PER_INCH,
  tabs: [POINTS_PER_INCH, 2 * POINTS_PER_INCH, 3 * POINTS_PER_INCH],
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

/**
 * Fold the ruler back inside the page.
 *
 * The page is as wide as the window lets it be, so the track width changes
 * whenever the shell is resized or the phone is rotated. Rather than storing
 * fractions and losing precision on every round trip, indents are stored in
 * points and clamped on the way out — a ruler dragged wide on a desktop and
 * reopened at 375px comes back sane instead of pushing the text off the page.
 */
export function clampRuler(ruler: RulerState, trackW: number): RulerState {
  const width = Math.max(MIN_COLUMN + 2, trackW);
  const right = clamp(ruler.rightIndent, MIN_COLUMN, width);
  const left = clamp(ruler.leftIndent, 0, right - MIN_COLUMN);
  const first = clamp(ruler.firstLine, 0, right - 12);
  const tabs = Array.from(new Set(ruler.tabs.map((t) => Math.round(t))))
    .filter((t) => t > 0 && t < width)
    .sort((a, b) => a - b);
  return { leftIndent: left, firstLine: first, rightIndent: right, tabs };
}

/** Move one marker, then re-clamp so the three can never cross each other. */
export function moveMarker(
  ruler: RulerState,
  marker: RulerMarker,
  x: number,
  trackW: number,
): RulerState {
  const snapped = Math.round(x);
  switch (marker) {
    case 'left':
      // The first-line marker rides along with the left one, the way a hanging
      // indent stays hung when you move the whole paragraph.
      return clampRuler(
        {
          ...ruler,
          leftIndent: snapped,
          firstLine: ruler.firstLine + (snapped - ruler.leftIndent),
        },
        trackW,
      );
    case 'first':
      return clampRuler({ ...ruler, firstLine: snapped }, trackW);
    case 'right':
      return clampRuler({ ...ruler, rightIndent: snapped }, trackW);
  }
}

export function addTab(ruler: RulerState, x: number, trackW: number): RulerState {
  return clampRuler({ ...ruler, tabs: [...ruler.tabs, Math.round(x)] }, trackW);
}

export function removeTab(ruler: RulerState, index: number, trackW: number): RulerState {
  return clampRuler(
    { ...ruler, tabs: ruler.tabs.filter((_, i) => i !== index) },
    trackW,
  );
}

export function moveTab(
  ruler: RulerState,
  index: number,
  x: number,
  trackW: number,
): RulerState {
  const tabs = ruler.tabs.map((t, i) => (i === index ? Math.round(x) : t));
  return clampRuler({ ...ruler, tabs }, trackW);
}

export interface RulerTick {
  x: number;
  /** True on the inch marks, which are the only ones that get a number. */
  major: boolean;
  /** Inch number, on major ticks only. */
  label?: string;
}

export function rulerTicks(trackW: number): RulerTick[] {
  const out: RulerTick[] = [];
  for (let x = 0; x <= trackW; x += RULER_TICK) {
    const inches = x / POINTS_PER_INCH;
    const major = Number.isInteger(inches);
    out.push({
      x,
      major,
      label: major && inches > 0 ? String(inches) : undefined,
    });
  }
  return out;
}

/**
 * Where the caret should land when Tab is pressed at `x`.
 *
 * `x` is the caret's own offset from the start of the text column, measured off
 * the live selection rather than counted in characters — which is what makes
 * this work at all with a proportional font and mixed bold and italic runs.
 */
export function nextTabStop(
  x: number,
  tabs: readonly number[],
  limit: number,
): number {
  const explicit = tabs.filter((t) => t > x + 0.5).sort((a, b) => a - b)[0];
  const stop =
    explicit ?? (Math.floor(x / DEFAULT_TAB_EVERY) + 1) * DEFAULT_TAB_EVERY;
  return Math.min(stop, Math.max(x, limit));
}

/** The indents, as the CSS the page actually wears. */
export function indentStyle(ruler: RulerState, trackW: number): CSSProperties {
  const r = clampRuler(ruler, trackW);
  return {
    paddingLeft: r.leftIndent,
    paddingRight: Math.max(0, trackW - r.rightIndent),
    // text-indent is relative to the left indent, and negative is legal — which
    // is exactly how a hanging indent is expressed.
    textIndent: r.firstLine - r.leftIndent,
  };
}

/* ----------------------------------------------------------- paragraphs ---- */

export type Alignment = 'left' | 'center' | 'right' | 'justify';

export const ALIGNMENTS: readonly { id: Alignment; command: string; label: string }[] = [
  { id: 'left', command: 'justifyLeft', label: 'Flush left' },
  { id: 'center', command: 'justifyCenter', label: 'Centred' },
  { id: 'right', command: 'justifyRight', label: 'Flush right' },
  { id: 'justify', command: 'justifyFull', label: 'Justified' },
];

export type SpacingId = 'single' | 'one-half' | 'double';

/**
 * Silkscreen is a pixel face with no descender room to speak of, so "single"
 * here is looser than a 1.0 leading would be — anything tighter and the
 * underlines collide with the next line's caps.
 */
export const LINE_SPACINGS: readonly { id: SpacingId; label: string; value: number }[] = [
  { id: 'single', label: '1', value: 1.6 },
  { id: 'one-half', label: '1½', value: 2.3 },
  { id: 'double', label: '2', value: 3.1 },
];

export function spacingValue(id: SpacingId): number {
  return LINE_SPACINGS.find((s) => s.id === id)?.value ?? 1.6;
}

/* ------------------------------------------------------------- counting ---- */

export function countWords(text: string): number {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed === '' ? 0 : trimmed.split(' ').length;
}

/** Characters as a typist counts them: newlines are not characters. */
export function countChars(text: string): number {
  return text.replace(/\r?\n/g, '').length;
}

/* ------------------------------------------------------- rich text plumbing ---- */

/**
 * The only place this shell touches `document.execCommand`.
 *
 * Same reasoning as the colour OS's word processor, and worth restating: the
 * standards-track replacement for execCommand is "write your own editing model
 * on `beforeinput` plus Range surgery", which is several hundred lines with
 * worse cross-browser parity than the deprecated API it replaces. Every current
 * engine still implements execCommand, so it is used, and confined here.
 */
export function runCommand(command: string, value?: string): void {
  try {
    document.execCommand(command, false, value);
  } catch {
    /* Unsupported command — leaving the document untouched is the right no-op. */
  }
}

export function commandActive(command: string): boolean {
  try {
    return document.queryCommandState(command);
  } catch {
    return false;
  }
}

export function currentAlignment(): Alignment {
  if (commandActive('justifyFull')) return 'justify';
  if (commandActive('justifyCenter')) return 'center';
  if (commandActive('justifyRight')) return 'right';
  return 'left';
}

/** Ask the engine for inline styles rather than <font> tags where it can. */
export function preferCssStyling(): void {
  try {
    document.execCommand('styleWithCSS', false, 'true');
  } catch {
    /* The <font>-tag fallback is still valid HTML. */
  }
}

/**
 * Scrub HTML on its way back out of storage.
 *
 * The saved document is reapplied by assigning `innerHTML` — there is no
 * `dangerouslySetInnerHTML` anywhere in this repo and there is not going to be
 * — and localStorage is writable by anything else that ever runs on this
 * origin, so what comes back is not trusted just because we wrote it.
 *
 * This used to be implemented here, which meant the colour OS's word processor
 * (which has the same problem) either had to import out of the 1984 shell or
 * keep a second, weaker copy. It kept the second copy. The scrubber now lives
 * in `lib/richtext/sanitize.ts`, below both shells and belonging to neither —
 * see the note at the top of that file — and BitWrite goes on importing it
 * from here, so nothing in this shell has heard of the other one.
 */
export { sanitizeStoredHtml } from '@/lib/richtext/sanitize';
