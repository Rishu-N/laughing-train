/**
 * The scripted transcripts demo mode replays.
 *
 * These are NOT transcriptions. Nothing is recorded and nothing is sent
 * anywhere when demo mode runs — the lines below are typed out on a timer to
 * show the shape of a dictation. Everything downstream (the history rows, the
 * status bar, the line Notes receives) is tagged `demo` so that distinction
 * survives after the text leaves this app.
 *
 * They read like real dictation on purpose: mid-thought, unpunctuated where a
 * person would be, the sort of thing you say to a microphone rather than write.
 */
export const DEMO_TRANSCRIPTS: readonly string[] = [
  'Note for the design doc — the level meter needs a decibel curve, not a linear one, or it barely twitches and everyone assumes the microphone is broken.',
  'Quick thought before I lose it: push to talk should cancel on escape, not on release.',
  'Remind me to check whether the accessibility permission survives a rebuild, because it did not last time.',
  'Draft a reply — thanks for the pointer, I have it working locally and I will push the branch tonight.',
  'Groceries: coffee, oat milk, the good bread, and something green so this does not become a personality.',
  'The transcript comes back empty about once in fifty tries and it is always the input device, never the model.',
] as const;

/** How long the fake capture runs before the fake transcription starts. */
export const DEMO_RECORD_MS = 1_200;
/** How long "Transcribing…" is shown. Long enough to read, short enough not to annoy. */
export const DEMO_TRANSCRIBE_MS = 450;
/** Typewriter cadence. Reduced-motion drops the whole line at once instead. */
export const DEMO_TYPE_MS = 14;

/**
 * A plausible level trace for the meter while demo mode "records".
 *
 * Speech is bursty, so a flat line or pure noise both look wrong. This is a slow
 * envelope with jitter on top, which reads as somebody talking.
 */
export function demoLevel(tick: number): number {
  const envelope = 0.06 + 0.09 * Math.abs(Math.sin(tick / 7)) + 0.05 * Math.abs(Math.sin(tick / 2.3));
  return Math.min(0.35, envelope * (0.7 + Math.random() * 0.6));
}
