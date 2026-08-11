/**
 * Fixed metrics and stacking order inside the classic shell.
 *
 * OWNER: Classic Boot agent.
 *
 * The shell root sets `isolation: isolate`, so every value here is scoped to
 * its own stacking context and none of it competes with LAYERS in
 * lib/os/layers.ts. Everything stays below 100 so the colour OS's rule — never
 * write a raw z-index above 100 in a component — still holds literally.
 */

/** The 1984 menu bar is thinner than System 7's. */
export const CLASSIC_MENUBAR_HEIGHT = 20;

export const CLASSIC_LAYERS = {
  /** Desk accessory windows start here and climb by one on each focus. */
  windowBase: 10,
  windowCeiling: 55,
  menuBar: 60,
  menuPopover: 70,
  notice: 80,
  dialog: 90,
  /** Startup plate, drawn over everything until the desktop is ready. */
  welcome: 95,
} as const;
