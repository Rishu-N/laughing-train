'use client';

/**
 * Cold boot: a Happy Mac, a beat, extensions loading along the bottom, then a
 * clean fade to the desktop. Budget is ~2s — this is a portfolio, nobody should
 * wait to see it.
 *
 * OWNER: OS Shell agent.
 *
 * prefers-reduced-motion skips the whole thing. Note that globals.css only
 * neutralizes CSS animation, and Framer Motion animates in JS, so the reduced
 * path is handled explicitly here (plus `motion-reduce:hidden`, which kills the
 * first paint of the overlay before the effect has had a chance to run).
 */
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SYSTEM_IMAGES } from '@/content/images';
import { LAYERS } from '@/lib/os/layers';
import { allApps } from '@/lib/os/registry';

/** Time on the boot screen before the fade begins. */
const BOOT_MS = 1750;
const FADE_MS = 0.3;
/** Extension icons start marching in here. */
const EXT_DELAY = 0.55;
const EXT_STEP = 0.075;
const MAX_EXTENSIONS = 10;

export default function BootSequence({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(true);

  // Held in a ref so a new inline callback from the parent can't restart the
  // timer — this effect must run exactly once.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const finish = () => {
      setVisible(false);
      onDoneRef.current();
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }
    const id = setTimeout(finish, BOOT_MS);
    return () => clearTimeout(id);
  }, []);

  // The row of icons along the bottom, System 7 "extensions loading" style.
  // Drawn from the live registry, so it always reflects the real OS.
  const extensions = useMemo(() => allApps().slice(0, MAX_EXTENSIONS), []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="boot"
          data-testid="boot-sequence"
          exit={{ opacity: 0 }}
          transition={{ duration: FADE_MS, ease: 'easeInOut' }}
          className="fixed inset-0 flex flex-col items-center justify-center bg-os-face motion-reduce:hidden"
          style={{ zIndex: LAYERS.boot }}
        >
          {/* Happy Mac — pops in on the CRT warming up. */}
          <motion.div
            initial={{ scale: 0.55, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.35, ease: [0.34, 1.4, 0.64, 1] }}
          >
            <Image
              src={SYSTEM_IMAGES.happyMac}
              alt="Happy Mac"
              width={96}
              height={96}
              className="pixelated"
              priority
            />
          </motion.div>

          {/* Welcome plate + progress. */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.25 }}
            className="mt-6 flex w-[min(280px,72vw)] flex-col items-center gap-3"
          >
            <p className="os-chrome-text text-[11px] leading-none">Welcome</p>

            <div className="os-inset h-3 w-full overflow-hidden rounded-[2px]">
              <motion.div
                className="h-full bg-os-accent"
                initial={{ width: '4%' }}
                animate={{ width: '100%' }}
                transition={{ delay: 0.45, duration: (BOOT_MS - 550) / 1000, ease: 'easeInOut' }}
              />
            </div>

            <p className="os-chrome-text text-[9px] leading-none text-os-ink-soft">
              Starting up…
            </p>
          </motion.div>

          {/* Extensions marching in along the bottom. */}
          <div className="absolute inset-x-0 bottom-6 flex flex-wrap items-center justify-center gap-1.5 px-4">
            {extensions.map((app, i) => (
              <motion.div
                key={app.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: EXT_DELAY + i * EXT_STEP, duration: 0.16 }}
              >
                <Image src={app.icon} alt="" width={20} height={20} className="pixelated" />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
