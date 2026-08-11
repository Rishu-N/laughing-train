'use client';

/**
 * The right-hand end of the classic menu bar: an optional clock, and the
 * blinking flag that remembers a dismissed software update.
 *
 * OWNER: Classic Boot agent.
 *
 * The blink is a state toggle rather than a CSS animation on purpose. A 1-bit
 * display blinks by inverting, not by fading, and globals.css collapses CSS
 * animation to 0.01ms under prefers-reduced-motion — which would leave a
 * keyframed blink frozen on an arbitrary frame.
 */
import { useEffect, useState } from 'react';
import { ICON_UPDATE } from '@/components/classic/icons';
import { BIT_FONT } from '@/components/classic/ui/Bit';
import PixelIcon from '@/components/classic/ui/PixelIcon';
import { useNow } from '@/lib/classic/clock';

const BLINK_MS = 620;

export function MenuClock() {
  const now = useNow();

  const label = now
    ? now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : '--:--';

  return (
    <span
      className={`${BIT_FONT} flex items-center px-2 text-[10px] leading-none select-none`}
    >
      {label}
    </span>
  );
}

export function UpdateFlag({
  onClick,
  blink,
}: {
  onClick: () => void;
  /** False under reduced motion: the flag just sits there, inverted. */
  blink: boolean;
}) {
  const [phase, setPhase] = useState(true);

  useEffect(() => {
    if (!blink) return;
    const id = window.setInterval(() => setPhase((v) => !v), BLINK_MS);
    return () => window.clearInterval(id);
  }, [blink]);

  // Under reduced motion the flag simply sits there, inverted and visible.
  const on = blink ? phase : true;

  return (
    <button
      type="button"
      aria-label="Software update available"
      onClick={onClick}
      className={[
        BIT_FONT,
        'flex cursor-default items-center px-2 select-none',
        'focus-visible:shadow-[inset_0_0_0_2px_#000] focus-visible:outline-none',
        on ? 'bg-black text-white' : 'bg-white text-black',
      ].join(' ')}
    >
      <PixelIcon map={ICON_UPDATE} size={14} />
    </button>
  );
}
