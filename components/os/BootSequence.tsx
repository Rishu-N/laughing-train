'use client';

/**
 * Boot overlay shown before the desktop appears.
 *
 * OWNER: OS Shell agent. Phase 0 baseline — a Happy Mac and a progress bar.
 */
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { SYSTEM_IMAGES } from '@/content/images';
import { LAYERS } from '@/lib/os/layers';

const BOOT_MS = 1600;

export default function BootSequence({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Users who prefer reduced motion skip straight to the desktop.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delay = reduced ? 0 : BOOT_MS;
    const id = setTimeout(() => {
      setVisible(false);
      onDone();
    }, delay);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="boot"
          data-testid="boot-sequence"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 flex flex-col items-center justify-center gap-5 bg-os-face"
          style={{ zIndex: LAYERS.boot }}
        >
          <Image
            src={SYSTEM_IMAGES.happyMac}
            alt="Happy Mac"
            width={96}
            height={96}
            className="pixelated"
            priority
          />
          <div className="os-inset h-3 w-56 overflow-hidden rounded-[2px]">
            <motion.div
              className="h-full bg-os-ink"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: BOOT_MS / 1000, ease: 'easeInOut' }}
            />
          </div>
          <p className="os-chrome-text text-[10px] text-os-ink-soft">Starting up…</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
