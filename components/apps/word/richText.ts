'use client';

/**
 * The only place in the app that touches `document.execCommand`.
 *
 * execCommand is deprecated, and the standards-track replacement is "implement
 * your own editing model on top of beforeinput + Range surgery" — hundreds of
 * lines for a toy word processor, with worse browser parity than the deprecated
 * API it replaces. Every current browser still implements execCommand, so we use
 * it, and confine it to this module: swapping in a real editor engine later means
 * rewriting this file and nothing else.
 */

/**
 * Re-exported, not reimplemented. The stored document is put back by assigning
 * `innerHTML`, and localStorage is writable by anything that ever runs on this
 * origin, so it gets scrubbed on the way in. The scrubber itself sits in
 * `lib/richtext/sanitize.ts` — below both shells, imported by neither's UI —
 * because the 1984 shell needs exactly the same thing and a second copy is how
 * this repo ended up with two standards for one risk. Word imports it from
 * here so the "all rich-text plumbing is in this file" rule still holds.
 */
export { sanitizeStoredHtml } from '@/lib/richtext/sanitize';

export type RichCommand =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'justifyLeft'
  | 'justifyCenter'
  | 'justifyRight'
  | 'fontSize'
  | 'fontName'
  | 'removeFormat';

export type Alignment = 'left' | 'center' | 'right';

export const ALIGN_COMMAND: Record<Alignment, RichCommand> = {
  left: 'justifyLeft',
  center: 'justifyCenter',
  right: 'justifyRight',
};

/**
 * Ask the browser to emit inline styles rather than <font> tags where it can.
 * Safe to call repeatedly; ignored by engines that don't support it.
 */
export function preferCssStyling(): void {
  try {
    document.execCommand('styleWithCSS', false, 'true');
  } catch {
    /* Not supported — the <font>-tag fallback still produces valid HTML. */
  }
}

/** Run a formatting command against the current selection. */
export function runCommand(command: RichCommand, value?: string): void {
  try {
    document.execCommand(command, false, value);
  } catch {
    /* Nothing sensible to do — leave the document untouched. */
  }
}

/** Whether a toggle command (bold/italic/…) applies to the current selection. */
export function isActive(command: RichCommand): boolean {
  try {
    return document.queryCommandState(command);
  } catch {
    return false;
  }
}

/** Current value of a valued command, e.g. `fontSize` -> "3". */
export function currentValue(command: RichCommand): string {
  try {
    return document.queryCommandValue(command) ?? '';
  } catch {
    return '';
  }
}

/** Which of the three alignments the selection currently sits in. */
export function currentAlignment(): Alignment {
  if (isActive('justifyCenter')) return 'center';
  if (isActive('justifyRight')) return 'right';
  return 'left';
}

/** execCommand's fontSize takes 1–7, not pixels. */
export const FONT_SIZES: { value: string; label: string }[] = [
  { value: '1', label: '9 pt' },
  { value: '2', label: '10 pt' },
  { value: '3', label: '12 pt' },
  { value: '4', label: '14 pt' },
  { value: '5', label: '18 pt' },
  { value: '6', label: '24 pt' },
  { value: '7', label: '36 pt' },
];

export const FONT_FAMILIES: { value: string; label: string }[] = [
  { value: 'Geneva, Verdana, sans-serif', label: 'Geneva' },
  { value: '"Times New Roman", Times, serif', label: 'Times' },
  { value: 'Helvetica, Arial, sans-serif', label: 'Helvetica' },
  { value: '"Courier New", Courier, monospace', label: 'Courier' },
];
