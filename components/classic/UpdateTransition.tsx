'use client';

/**
 * The Software Update handoff: the 1-bit mark glitches, dissolves into dither,
 * and the "Rishu Inc" wordmark resolves out of the same dither on the far side.
 *
 * OWNER: Classic Boot agent.
 *
 * ⚠️ Two hard requirements (CONTRACT-PHASE3.md §3):
 *   1. data-testid="update-transition" must UNMOUNT when this finishes.
 *   2. finishUpdate() must be called, or the visitor is stranded on a dead
 *      screen forever. It is wired to the animation's own completion callback
 *      AND to a safety timeout, because a backgrounded tab pauses rAF and a
 *      dropped Framer callback would otherwise be fatal.
 *
 * The dissolve is a real ordered dither: a coarse grid of white cells that flip
 * on in a scattered order, which is how a 1-bit machine faded anything. Nothing
 * on screen is ever a gray value.
 */
import { motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ClassicMark, RishuIncWordmark } from '@/components/classic/BrandMarks';
import { BIT_FONT } from '@/components/classic/ui/Bit';
import { usePrefersReducedMotion } from '@/lib/classic/media';
import {
  dissolveStart,
  revealStart,
  transitionTiming,
} from '@/lib/classic/timing';
import { useStageStore } from '@/lib/os/stageStore';

/** Dissolve grid. Coarse on purpose — this is 1984, not a shader. */
const COLS = 16;
const ROWS = 12;

/**
 * A deterministic scatter in [0,1) per cell. Deterministic rather than random
 * so the server and client agree during hydration, and so the dissolve looks
 * the same every time — which, on a machine with one dither pattern, it did.
 */
function scatter(index: number, salt: number): number {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export default function UpdateTransition() {
  const finishUpdate = useStageStore((s) => s.finishUpdate);
  const reducedMotion = usePrefersReducedMotion();
  const t = transitionTiming(reducedMotion);
  const done = useRef(false);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    finishUpdate();
  }, [finishUpdate]);

  // The safety net. If the animation callback never lands — backgrounded tab,
  // a paused rAF, anything — this still moves the visitor into the colour OS.
  useEffect(() => {
    const id = window.setTimeout(finish, t.safetyMs);
    return () => window.clearTimeout(id);
  }, [finish, t.safetyMs]);

  const total = t.totalMs;
  const outStart = dissolveStart(t);
  const inStart = revealStart(t);

  /**
   * Each cell covers the mark at one moment and uncovers the wordmark at
   * another, both scattered. Expressed as one keyframe track per cell with
   * hard steps, so a cell is only ever fully black-on-white or absent.
   */
  const cells = useMemo(() => {
    const eps = 0.004;
    return Array.from({ length: COLS * ROWS }, (_, i) => {
      const out = (outStart + scatter(i, 1) * t.dissolveMs) / total;
      const back = (inStart + scatter(i, 2) * t.revealMs) / total;
      const o1 = Math.min(out, 1 - 4 * eps);
      const b1 = Math.max(Math.min(back, 1 - eps), o1 + 2 * eps);
      return { key: i, times: [0, o1, o1 + eps, b1, b1 + eps, 1] };
    });
  }, [outStart, inStart, t.dissolveMs, t.revealMs, total]);

  return (
    <motion.div
      data-testid="update-transition"
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.22 }}
      className={`${BIT_FONT} fixed inset-0 overflow-hidden bg-white text-black`}
      style={{ isolation: 'isolate' }}
    >
      {/* Layer 0 — the wordmark, waiting under the dither. */}
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <RishuIncWordmark width={260} />
      </div>

      {/* Layer 1 — the mark and the install bar. Opaque, so it hides the
          wordmark below; hard-cut away the instant the dissolve above has
          fully covered it. */}
      <motion.div
        className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-white"
        style={{ zIndex: 1 }}
        initial={{ opacity: 1 }}
        animate={{ opacity: [1, 1, 0, 0] }}
        transition={{
          duration: total / 1000,
          times: [0, (outStart + t.dissolveMs) / total, (outStart + t.dissolveMs) / total + 0.001, 1],
          ease: 'linear',
        }}
      >
        <motion.div
          animate={
            reducedMotion
              ? undefined
              : { x: [0, -3, 2, -1, 3, 0], y: [0, 1, -2, 1, 0, 0] }
          }
          transition={{ duration: 0.34, repeat: Infinity, ease: 'linear' }}
        >
          <ClassicMark size={72} />
        </motion.div>

        <div className="flex w-[min(240px,70vw)] flex-col gap-2">
          <div className="h-[10px] border border-black p-[1px]">
            <motion.div
              className="h-full bg-black"
              initial={{ width: '2%' }}
              animate={{ width: '100%' }}
              transition={{ duration: t.installMs / 1000, ease: 'linear' }}
            />
          </div>
          <p className="text-center text-[9px] leading-none">
            Installing system software…
          </p>
        </div>

        {/* A scanline that inverts whatever it crosses. mix-blend-mode
            difference over black-and-white is an exact video invert, so the
            glitch never introduces a gray pixel. */}
        {!reducedMotion && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 h-[6px] bg-white"
            style={{ mixBlendMode: 'difference' }}
            initial={{ top: '0%' }}
            animate={{ top: ['0%', '100%'] }}
            transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}
          />
        )}
      </motion.div>

      {/* Layer 2 — the dither. Starts clear (so the mark shows), covers the
          mark cell by cell, then clears again cell by cell to resolve the
          wordmark underneath. One coarse grid doing both halves of the fade. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 grid"
        style={{
          zIndex: 2,
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS}, 1fr)`,
        }}
      >
        {cells.map((cell) => (
          <motion.div
            key={cell.key}
            className="bg-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 1, 1, 0, 0] }}
            transition={{ duration: total / 1000, times: cell.times, ease: 'linear' }}
          />
        ))}
      </div>

      {/* The animation's own clock. When this completes, the transition is
          over — the safety timeout above only covers the case where it never
          does. */}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute h-px w-px"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.01 }}
        transition={{ duration: total / 1000, ease: 'linear' }}
        onAnimationComplete={finish}
      />
    </motion.div>
  );
}
