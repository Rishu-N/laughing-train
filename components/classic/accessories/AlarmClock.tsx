'use client';

/**
 * Alarm Clock — shows the time, and pulls down to reveal an alarm it will
 * never actually ring.
 *
 * OWNER: Classic Boot agent. Cosmetic homage, with a real ticking clock.
 *
 * The readout stays blank until after mount so server and client agree during
 * hydration — a clock is the classic way to get a mismatch warning.
 */
import { useState } from 'react';
import { ICON_CLOCK } from '@/components/classic/icons';
import { BIT_FONT, BitButton, BitRule } from '@/components/classic/ui/Bit';
import PixelIcon from '@/components/classic/ui/PixelIcon';
import { useNow } from '@/lib/classic/clock';

function two(n: number): string {
  return String(n).padStart(2, '0');
}

export default function AlarmClock() {
  const now = useNow();
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);

  const hours24 = now?.getHours() ?? 0;
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const time = now
    ? `${two(hours12)}:${two(now.getMinutes())}:${two(now.getSeconds())} ${hours24 < 12 ? 'AM' : 'PM'}`
    : '--:--:-- --';
  const date = now
    ? now.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : '—';

  return (
    <div className={`${BIT_FONT} flex h-full flex-col gap-2 bg-white p-2 text-black`}>
      <div className="flex items-center gap-2 border border-black px-2 py-2">
        <PixelIcon map={ICON_CLOCK} size={24} />
        <span
          aria-live="off"
          aria-label="Current time"
          className="flex-1 text-center text-[13px] leading-none tabular-nums"
        >
          {time}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] leading-none">{date}</span>
        <BitButton
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Close Drawer' : 'Open Drawer'}
        </BitButton>
      </div>

      {open && (
        <>
          <BitRule />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] leading-none">Alarm 07:00 AM</span>
            <button
              type="button"
              role="switch"
              aria-checked={armed}
              aria-label="Alarm"
              onClick={() => setArmed((a) => !a)}
              className="flex h-[14px] w-[14px] cursor-default items-center justify-center border border-black text-[10px] leading-none active:bg-black active:text-white focus-visible:shadow-[inset_0_0_0_2px_#000] focus-visible:outline-none"
            >
              {armed ? '✕' : ''}
            </button>
          </div>
          <p className="text-[8px] leading-[1.5]">
            This machine has no speaker worth waking anyone with.
          </p>
        </>
      )}
    </div>
  );
}
