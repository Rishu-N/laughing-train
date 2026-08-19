'use client';

/**
 * LIVE / DEMO tag.
 *
 * The single most important two square centimetres in this app. Scripted text
 * and a real transcription are indistinguishable once they are just words on a
 * screen, so every place a transcript is shown gets one of these, and the demo
 * variant is the loud one.
 */
import type { DictationSource } from '@/lib/os/dictation';

export function SourceBadge({ source }: { source: DictationSource }) {
  const demo = source === 'demo';
  return (
    <span
      className={`os-chrome-text inline-block shrink-0 rounded-[2px] border border-os-ink px-1 py-[1px] text-[9px] leading-none ${
        demo ? 'bg-os-warn text-os-ink' : 'bg-os-ok text-os-face'
      }`}
      title={
        demo
          ? 'Scripted text. Nothing was recorded and nothing was sent.'
          : 'Transcribed from a real recording.'
      }
    >
      {demo ? 'DEMO' : 'LIVE'}
    </span>
  );
}
