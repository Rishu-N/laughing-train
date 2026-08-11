'use client';

/**
 * Media-query hooks for the classic shell.
 *
 * OWNER: Classic Boot agent.
 *
 * globals.css neutralises CSS animation under prefers-reduced-motion, but the
 * classic shell's timing lives in JS (Framer Motion + setTimeout), so it has to
 * ask for itself. useSyncExternalStore keeps the server snapshot honest — SSR
 * always renders the "no preference / wide" branch, and the client corrects it
 * during hydration without a mismatch warning.
 */
import { useSyncExternalStore } from 'react';

function subscribe(query: string) {
  return (onChange: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  };
}

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    subscribe(query),
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * True when the visitor has asked for reduced motion. The classic shell
 * *shortens* rather than removes: the update notification still arrives, it
 * just arrives sooner and without the spring.
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * Phone-width layout. Below this the 1-bit windows stop being draggable and
 * snap to a near-full-width sheet so everything stays usable at 375px.
 */
export const CLASSIC_NARROW_BREAKPOINT = 640;

export function useIsNarrow(): boolean {
  return useMediaQuery(`(max-width: ${CLASSIC_NARROW_BREAKPOINT - 1}px)`);
}
