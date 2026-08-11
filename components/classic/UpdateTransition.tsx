'use client';

/**
 * The Software Update transition: the monochrome mark dissolves/glitches away
 * and the "Rishu Inc" wordmark animates in, handing off to the colour OS.
 *
 * OWNER: Classic Boot agent. Phase 3 stub — replace entirely.
 *
 * MUST call useStageStore.getState().finishUpdate() when the animation ends,
 * or the site never reaches the colour OS. Keep a safety timeout so a dropped
 * animation callback can't strand the visitor here.
 */
import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { useStageStore } from '@/lib/os/stageStore';

const STUB_MS = 900;

export default function UpdateTransition() {
  const finishUpdate = useStageStore((s) => s.finishUpdate);

  useEffect(() => {
    const id = setTimeout(finishUpdate, STUB_MS);
    return () => clearTimeout(id);
  }, [finishUpdate]);

  return (
    <motion.div
      data-testid="update-transition"
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center bg-white text-black"
    >
      <p className="font-[family-name:var(--font-os-ui)] text-[11px]">Updating…</p>
    </motion.div>
  );
}
