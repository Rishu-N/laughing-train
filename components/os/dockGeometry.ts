/**
 * Dock tile metrics, shared between the Dock (which draws the tiles) and the
 * Window (which needs to know where a tile lives so a minimizing window can
 * visibly travel toward it).
 *
 * OWNER: OS Shell agent.
 *
 * Keeping the numbers here rather than inside Dock.tsx is what lets the genie
 * animation land on the right tile without the window reaching into the DOM.
 */
import { DOCK_HEIGHT_MOBILE, DOCK_WIDTH, MENUBAR_HEIGHT } from '@/lib/os/layers';

/** Square tile edge in the vertical (desktop) dock. */
export const DOCK_TILE = 56;
/** Square tile edge in the horizontal (mobile) dock. */
export const DOCK_TILE_MOBILE = 48;
/** Gap between tiles, both orientations. */
export const DOCK_GAP = 6;
/** Padding at the leading edge of the tile strip. */
export const DOCK_PAD = 8;

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Viewport rect of the Nth dock tile. Approximate by design: if the dock has
 * scrolled, the index is clamped into the visible band so a minimizing window
 * still flies somewhere sensible instead of off-screen.
 */
export function dockSlotRect(
  index: number,
  isMobile: boolean,
  viewport: { width: number; height: number },
): Rect {
  const i = Math.max(0, index);

  if (isMobile) {
    const stride = DOCK_TILE_MOBILE + DOCK_GAP;
    const visible = Math.max(1, Math.floor((viewport.width - DOCK_PAD * 2) / stride));
    const slot = Math.min(i, visible - 1);
    return {
      left: DOCK_PAD + slot * stride,
      top: viewport.height - DOCK_HEIGHT_MOBILE + (DOCK_HEIGHT_MOBILE - DOCK_TILE_MOBILE) / 2,
      width: DOCK_TILE_MOBILE,
      height: DOCK_TILE_MOBILE,
    };
  }

  const stride = DOCK_TILE + DOCK_GAP;
  const band = viewport.height - MENUBAR_HEIGHT - DOCK_PAD * 2;
  const visible = Math.max(1, Math.floor(band / stride));
  const slot = Math.min(i, visible - 1);
  return {
    left: viewport.width - DOCK_WIDTH + (DOCK_WIDTH - DOCK_TILE) / 2,
    top: MENUBAR_HEIGHT + DOCK_PAD + slot * stride,
    width: DOCK_TILE,
    height: DOCK_TILE,
  };
}
