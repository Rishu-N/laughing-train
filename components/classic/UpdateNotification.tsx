'use client';

/**
 * "Software Update Available" — the notification that drops in from the
 * top-left a few seconds into the classic screen, and the only way forward.
 *
 * OWNER: Classic Boot agent.
 *
 * ⚠️ The Install control carries data-testid="software-update-action". The
 * whole e2e suite comes through it (tests/helpers.ts → throughClassicShell),
 * and it must become visible on its own within ~20s of the shell mounting.
 * Renaming it or gating it behind an interaction breaks every test.
 */
import { motion } from 'framer-motion';
import { useEffect, useId, useRef } from 'react';
import { ICON_UPDATE } from '@/components/classic/icons';
import { BIT_FONT, BitButton } from '@/components/classic/ui/Bit';
import PixelIcon from '@/components/classic/ui/PixelIcon';
import { CLASSIC_LAYERS, CLASSIC_MENUBAR_HEIGHT } from '@/lib/classic/metrics';

export interface UpdateNotificationProps {
  onAccept: () => void;
  onLater: () => void;
  reducedMotion: boolean;
}

export default function UpdateNotification({
  onAccept,
  onLater,
  reducedMotion,
}: UpdateNotificationProps) {
  const headingId = useId();
  const acceptRef = useRef<HTMLButtonElement>(null);

  // Take focus only if the visitor hasn't started doing something else — this
  // is the call to action of the whole screen, but interrupting someone
  // mid-keystroke in the Note Pad would be rude.
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body) {
      acceptRef.current?.focus({ preventScroll: true });
    }
  }, []);

  return (
    <motion.aside
      aria-labelledby={headingId}
      initial={{ x: -28, y: -140 }}
      animate={{ x: 0, y: 0 }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : { type: 'spring', stiffness: 360, damping: 26, mass: 0.9 }
      }
      className={`${BIT_FONT} absolute w-[min(304px,calc(100%-16px))] border-2 border-black bg-white text-black`}
      style={{ left: 8, top: CLASSIC_MENUBAR_HEIGHT + 8, zIndex: CLASSIC_LAYERS.notice }}
    >
      <p className="border-b-2 border-black bg-black px-2 py-1 text-[9px] leading-none text-white">
        System Update
      </p>

      <div className="flex gap-3 p-3">
        <div className="shrink-0">
          <PixelIcon map={ICON_UPDATE} size={32} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="text-[11px] leading-tight">
            Software Update Available
          </h2>
          <p className="mt-2 text-[9px] leading-[1.7]">
            A newer system is ready to install. It adds colour, overlapping
            windows you can resize, and something called the World Wide Web.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2 px-3 pb-3">
        <BitButton onClick={onLater}>Later</BitButton>
        {/* data-testid is a contract with the e2e suite — CONTRACT-PHASE3.md §3. */}
        <BitButton
          ref={acceptRef}
          primary
          data-testid="software-update-action"
          onClick={onAccept}
        >
          Install
        </BitButton>
      </div>
    </motion.aside>
  );
}
