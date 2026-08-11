'use client';

/**
 * A one-second wall clock, shared by the Alarm Clock accessory and the
 * menu-bar clock.
 *
 * OWNER: Classic Boot agent.
 *
 * Written as an external store rather than `setNow(new Date())` inside an
 * effect: the time is an external system React should subscribe to, not state
 * React owns, and the effect version both trips react-hooks/set-state-in-effect
 * and runs one cascading render per mount. The server snapshot is null, so SSR
 * renders a blank readout and the real time arrives after hydration — which is
 * the only way a clock avoids a hydration mismatch.
 */
import { useSyncExternalStore } from 'react';

const TICK_MS = 1000;

let snapshot: number | null = null;
let timer: number | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === undefined) {
    snapshot = Date.now();
    timer = window.setInterval(() => {
      snapshot = Date.now();
      listeners.forEach((l) => l());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
      snapshot = null;
    }
  };
}

/** Cached — useSyncExternalStore requires a stable value between ticks. */
function getSnapshot(): number | null {
  return snapshot;
}

function getServerSnapshot(): number | null {
  return null;
}

/** The current time, or null before the first tick (and during SSR). */
export function useNow(): Date | null {
  const ms = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return ms === null ? null : new Date(ms);
}
