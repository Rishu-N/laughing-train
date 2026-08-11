'use client';

import { useEffect, useState } from 'react';
import { MOBILE_BREAKPOINT } from '@/lib/os/layers';

/**
 * True below the mobile breakpoint. In mobile layout the OS becomes
 * single-window: windows fill the screen, drag/resize are disabled and the dock
 * moves to the bottom.
 *
 * Returns false during SSR and the first client render so markup matches.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isMobile;
}

/** Live viewport size, for maximize and drag clamping. */
export function useViewport(): { width: number; height: number } {
  const [size, setSize] = useState({ width: 1280, height: 800 });

  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return size;
}
