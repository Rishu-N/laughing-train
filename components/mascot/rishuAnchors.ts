/**
 * Where Rishu is allowed to stand.
 *
 * OWNER: Mascot agent.
 *
 * Rule 4 of the brief: never over the middle of what someone is using. So the
 * anchor set is edges and corners only — skirting boards, really — and the
 * colour OS variants step around the dock and the menu bar rather than sitting
 * on them. He also faces inward: a right-edge anchor mirrors the sprite so the
 * wave goes toward the screen instead of off it.
 */
import type { CSSProperties } from 'react';
import {
  DOCK_HEIGHT_MOBILE,
  DOCK_WIDTH,
  MENUBAR_HEIGHT,
  MOBILE_BREAKPOINT,
} from '@/lib/os/layers';
import type { RishuContext } from './rishuOdds';

export interface RishuAnchor {
  /** Absolute placement within the fixed, full-viewport overlay. */
  style: CSSProperties;
  /** Offset he slides in from, px — always out of the nearest edge. */
  from: { x: number; y: number };
  /** Mirror the sprite so he faces into the screen. */
  flip: boolean;
}

/** How far out of the edge he starts and ends. */
const SLIDE = 9;

interface Insets {
  right: number;
  bottom: number;
  top: number;
}

function insetsFor(context: RishuContext, viewportWidth: number): Insets {
  if (context === 'classic') {
    // The 1984 shell is a bare screen with a thin menu bar and nothing else.
    return { right: 0, bottom: 0, top: MENUBAR_HEIGHT };
  }
  // The colour OS puts the dock on the right, or along the bottom on mobile.
  const mobile = viewportWidth < MOBILE_BREAKPOINT;
  return {
    right: mobile ? 0 : DOCK_WIDTH,
    bottom: mobile ? DOCK_HEIGHT_MOBILE : 0,
    top: MENUBAR_HEIGHT,
  };
}

function anchorsFor(context: RishuContext, viewportWidth: number): RishuAnchor[] {
  const inset = insetsFor(context, viewportWidth);
  return [
    // Bottom-left corner — the safest square metre on any screen.
    {
      style: { left: 18, bottom: inset.bottom + 6 },
      from: { x: 0, y: SLIDE },
      flip: false,
    },
    // Along the bottom edge, off to the left of centre.
    {
      style: { left: '17%', bottom: inset.bottom + 2 },
      from: { x: 0, y: SLIDE },
      flip: false,
    },
    // Bottom-right, clear of the dock.
    {
      style: { right: inset.right + 20, bottom: inset.bottom + 6 },
      from: { x: 0, y: SLIDE },
      flip: true,
    },
    // Hugging the left edge, low enough to be under most windows.
    {
      style: { left: 3, top: '68%' },
      from: { x: -SLIDE, y: 0 },
      flip: false,
    },
    // Hugging the right edge, inboard of the dock.
    {
      style: { right: inset.right + 3, top: '62%' },
      from: { x: SLIDE, y: 0 },
      flip: true,
    },
    // Just under the menu bar in the top-right gutter.
    {
      style: { right: inset.right + 28, top: inset.top + 4 },
      from: { x: 0, y: -SLIDE },
      flip: true,
    },
  ];
}

/** Pick one edge slot at random. Call from an event handler — reads `window`. */
export function pickAnchor(context: RishuContext, rng: () => number = Math.random): RishuAnchor {
  const width = typeof window === 'undefined' ? 1024 : window.innerWidth;
  const options = anchorsFor(context, width);
  return options[Math.floor(rng() * options.length)] ?? options[0];
}
