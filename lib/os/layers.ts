/**
 * Reserved stacking layers. Windows live below all of these.
 *
 * FROZEN in Phase 0. Never hardcode a z-index in a component — import from here.
 */
export const LAYERS = {
  /** Windows start here and climb by 1 on each focus. */
  windowBase: 100,
  /** When the top window passes this, the store renormalizes everything back down. */
  windowCeiling: 8000,
  dock: 9000,
  menuBar: 9500,
  /** Menus and popovers that must sit above the menu bar that spawned them. */
  menuPopover: 9600,
  boot: 9900,
} as const;

/** Breakpoint below which the OS switches to single-window mobile behaviour. */
export const MOBILE_BREAKPOINT = 768;

/** Height of the top menu bar in px. Windows are constrained below it. */
export const MENUBAR_HEIGHT = 24;

/** Width of the right-hand dock in px (desktop only; mobile docks to the bottom). */
export const DOCK_WIDTH = 76;

/** Height of the bottom dock in px when in mobile layout. */
export const DOCK_HEIGHT_MOBILE = 64;
