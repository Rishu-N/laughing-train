'use client';

/**
 * The live level meter, ported from the Mac app's WaveformView.
 *
 * The scaling is the part worth keeping. Speech RMS sits around 0.01–0.2, so
 * mapping it linearly to bar height produces a meter that barely twitches and
 * reads as "the microphone is broken". Loudness perception is roughly
 * logarithmic, so levels go through decibels and are mapped across a
 * speech-relevant window instead. That is what makes the bars track what you
 * hear.
 */

/** Quietest level shown. Below a quiet room, above most built-in mics' noise floor. */
const FLOOR_DB = -55;
/** Loudest shown. Speech peaks well under 0 dBFS; clamping here uses the full height. */
const CEILING_DB = -8;

const MIN_HEIGHT_PCT = 8;

function heightPct(level: number): number {
  if (level <= 0) return MIN_HEIGHT_PCT;
  const db = 20 * Math.log10(Math.max(level, 1e-6));
  const normalized = (db - FLOOR_DB) / (CEILING_DB - FLOOR_DB);
  const clamped = Math.max(0, Math.min(1, normalized));
  return MIN_HEIGHT_PCT + clamped * (100 - MIN_HEIGHT_PCT);
}

export function Waveform({
  levels,
  active,
  className = '',
}: {
  levels: number[];
  active: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`os-inset flex h-[26px] min-w-0 items-center justify-center gap-[2px] px-1 ${className}`}
    >
      {levels.map((level, index) => (
        <div
          key={index}
          className={active ? 'bg-os-alert' : 'bg-os-chrome-dark'}
          style={{
            width: 3,
            height: `${heightPct(level)}%`,
            // Newer bars — on the right, where audio is arriving — are drawn at
            // full strength and older ones fade, which gives the meter a sense
            // of direction without animating position.
            opacity: active ? 0.4 + (0.6 * index) / Math.max(levels.length - 1, 1) : 0.5,
          }}
        />
      ))}
    </div>
  );
}

/**
 * The recording dot. Separate from the meter because it must keep moving in
 * total silence — otherwise a quiet moment looks identical to a crashed
 * recorder. Uses a CSS animation so the global prefers-reduced-motion rule in
 * globals.css can neutralise it.
 */
export function RecordingDot() {
  return (
    <span
      aria-hidden
      className="inline-block h-[9px] w-[9px] shrink-0 animate-pulse rounded-full bg-os-alert"
    />
  );
}
