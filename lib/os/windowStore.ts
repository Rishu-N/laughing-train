/**
 * The window manager. Single source of truth for what is open, where, and on top.
 *
 * OWNER: OS Shell agent. Everyone else reads this store but does not edit this file.
 *
 * Usage from any app or component:
 *   const openApp = useWindowStore((s) => s.openApp);
 *   openApp('paint');
 *
 * Usage from non-React code (e.g. the terminal command parser):
 *   useWindowStore.getState().openApp('paint');
 */
import { create } from 'zustand';
import {
  DOCK_HEIGHT_MOBILE,
  DOCK_WIDTH,
  LAYERS,
  MENUBAR_HEIGHT,
  MOBILE_BREAKPOINT,
} from './layers';
import { getApp } from './registry';
import type { OpenAppOptions, WindowInstance } from './types';

const DEFAULT_MIN_SIZE = { width: 240, height: 160 };

/** Each new cascaded window steps down-right by this much from the last. */
const CASCADE_STEP = 26;
const CASCADE_WRAP = 6;

/** How much of a window must stay inside the work area at all times. */
const MIN_ONSCREEN = 96;

/** Window coordinates are viewport coordinates; this is the usable slab. */
interface WorkArea {
  left: number;
  top: number;
  width: number;
  height: number;
}

function currentViewport(vp?: { width: number; height: number }) {
  if (vp) return vp;
  if (typeof window === 'undefined') return { width: 1280, height: 800 };
  return { width: window.innerWidth, height: window.innerHeight };
}

/** The desktop minus the menu bar and the dock. */
function workArea(vp?: { width: number; height: number }): WorkArea {
  const v = currentViewport(vp);
  const mobile = v.width < MOBILE_BREAKPOINT;
  return {
    left: 0,
    top: MENUBAR_HEIGHT,
    width: Math.max(v.width - (mobile ? 0 : DOCK_WIDTH), DEFAULT_MIN_SIZE.width),
    height: Math.max(
      v.height - MENUBAR_HEIGHT - (mobile ? DOCK_HEIGHT_MOBILE : 0),
      DEFAULT_MIN_SIZE.height,
    ),
  };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

let instanceCounter = 0;
function nextInstanceId(appId: string) {
  instanceCounter += 1;
  return `${appId}#${instanceCounter}`;
}

export interface WindowStore {
  windows: WindowInstance[];
  focusedId: string | null;
  /** Monotonic z-index dispenser; renormalized when it passes LAYERS.windowCeiling. */
  topZ: number;
  /** How many windows have been cascaded, used to offset the next one. */
  cascadeIndex: number;

  openApp: (appId: string, opts?: OpenAppOptions) => string | null;
  closeWindow: (instanceId: string) => void;
  minimizeWindow: (instanceId: string) => void;
  restoreWindow: (instanceId: string) => void;
  toggleMinimize: (instanceId: string) => void;
  toggleMaximize: (instanceId: string, viewport?: { width: number; height: number }) => void;
  focusWindow: (instanceId: string) => void;
  moveWindow: (instanceId: string, x: number, y: number) => void;
  resizeWindow: (instanceId: string, width: number, height: number) => void;
  setTitle: (instanceId: string, title: string) => void;
  closeAll: () => void;

  /**
   * Drop focus without minimizing anything — what clicking bare desktop does.
   * Windows stay where they are; the topmost one simply stops looking active.
   */
  defocusAll: () => void;
  /**
   * Re-clamp every window into the work area. Called by the shell on viewport
   * resize so a window can never end up stranded outside the screen.
   */
  clampToViewport: (viewport?: { width: number; height: number }) => void;
}

export const useWindowStore = create<WindowStore>((set, get) => ({
  windows: [],
  focusedId: null,
  topZ: LAYERS.windowBase,
  cascadeIndex: 0,

  openApp: (appId, opts) => {
    const def = getApp(appId);
    if (!def) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[windowStore] openApp: unknown app id "${appId}"`);
      }
      return null;
    }

    // Singleton apps (the default) refocus rather than opening a duplicate.
    const singleton = def.singleton !== false;
    if (singleton) {
      const existing = get().windows.find((w) => w.appId === appId);
      if (existing) {
        get().restoreWindow(existing.instanceId);
        return existing.instanceId;
      }
    }

    const instanceId = nextInstanceId(appId);
    const area = workArea();

    // A 720px-wide default on a 900px screen would open half off the edge, so
    // opening size is always clamped to what the desktop can actually show.
    const requested = opts?.size ?? def.defaultSize;
    const min = def.minSize ?? DEFAULT_MIN_SIZE;
    const size = {
      width: Math.max(Math.min(requested.width, area.width), Math.min(min.width, area.width)),
      height: Math.max(Math.min(requested.height, area.height), Math.min(min.height, area.height)),
    };

    set((state) => {
      const z = state.topZ + 1;

      let position = opts?.position ?? def.defaultPosition;
      let cascadeIndex = state.cascadeIndex;
      if (!position) {
        const step = cascadeIndex % CASCADE_WRAP;
        position = {
          x: area.left + 48 + step * CASCADE_STEP,
          y: area.top + 20 + step * CASCADE_STEP,
        };
        cascadeIndex = cascadeIndex + 1;
      }

      const x = clamp(position.x, area.left, Math.max(area.left, area.left + area.width - size.width));
      const y = clamp(position.y, area.top, Math.max(area.top, area.top + area.height - size.height));

      const win: WindowInstance = {
        instanceId,
        appId,
        title: def.title,
        x,
        y,
        width: size.width,
        height: size.height,
        zIndex: z,
        minimized: false,
        maximized: false,
        params: opts?.params ?? def.params,
      };

      return {
        windows: [...state.windows, win],
        focusedId: instanceId,
        topZ: z,
        cascadeIndex,
      };
    });

    normalizeIfNeeded(set, get);
    return instanceId;
  },

  closeWindow: (instanceId) =>
    set((state) => {
      const windows = state.windows.filter((w) => w.instanceId !== instanceId);
      const focusedId =
        state.focusedId === instanceId ? topmostVisibleId(windows) : state.focusedId;
      return { windows, focusedId };
    }),

  minimizeWindow: (instanceId) =>
    set((state) => {
      const windows = state.windows.map((w) =>
        w.instanceId === instanceId ? { ...w, minimized: true } : w,
      );
      const focusedId =
        state.focusedId === instanceId ? topmostVisibleId(windows) : state.focusedId;
      return { windows, focusedId };
    }),

  restoreWindow: (instanceId) => {
    set((state) => {
      const z = state.topZ + 1;
      return {
        windows: state.windows.map((w) =>
          w.instanceId === instanceId ? { ...w, minimized: false, zIndex: z } : w,
        ),
        focusedId: instanceId,
        topZ: z,
      };
    });
    normalizeIfNeeded(set, get);
  },

  toggleMinimize: (instanceId) => {
    const win = get().windows.find((w) => w.instanceId === instanceId);
    if (!win) return;
    if (win.minimized) get().restoreWindow(instanceId);
    else get().minimizeWindow(instanceId);
  },

  toggleMaximize: (instanceId, viewport) =>
    set((state) => ({
      windows: state.windows.map((w) => {
        if (w.instanceId !== instanceId) return w;
        if (w.maximized) {
          const r = w.restoreRect;
          return r
            ? { ...w, maximized: false, x: r.x, y: r.y, width: r.width, height: r.height }
            : { ...w, maximized: false };
        }
        const area = workArea(viewport);
        return {
          ...w,
          maximized: true,
          restoreRect: { x: w.x, y: w.y, width: w.width, height: w.height },
          x: area.left,
          y: area.top,
          width: area.width,
          height: area.height,
        };
      }),
    })),

  focusWindow: (instanceId) => {
    const state = get();
    // Already on top and focused — nothing to do, and skipping the set() avoids
    // a re-render storm on every pointerdown during a drag.
    if (state.focusedId === instanceId) {
      const win = state.windows.find((w) => w.instanceId === instanceId);
      if (win && win.zIndex === state.topZ) return;
    }
    set((s) => {
      const z = s.topZ + 1;
      return {
        windows: s.windows.map((w) =>
          w.instanceId === instanceId ? { ...w, zIndex: z } : w,
        ),
        focusedId: instanceId,
        topZ: z,
      };
    });
    normalizeIfNeeded(set, get);
  },

  moveWindow: (instanceId, x, y) =>
    set((state) => ({
      windows: state.windows.map((w) =>
        w.instanceId === instanceId ? { ...w, x, y } : w,
      ),
    })),

  resizeWindow: (instanceId, width, height) =>
    set((state) => ({
      windows: state.windows.map((w) => {
        if (w.instanceId !== instanceId) return w;
        const def = getApp(w.appId);
        const min = def?.minSize ?? DEFAULT_MIN_SIZE;
        return {
          ...w,
          width: Math.max(width, min.width),
          height: Math.max(height, min.height),
        };
      }),
    })),

  setTitle: (instanceId, title) =>
    set((state) => ({
      windows: state.windows.map((w) =>
        w.instanceId === instanceId ? { ...w, title } : w,
      ),
    })),

  closeAll: () => set({ windows: [], focusedId: null, cascadeIndex: 0 }),

  defocusAll: () => {
    if (get().focusedId === null) return;
    set({ focusedId: null });
  },

  clampToViewport: (viewport) => {
    const area = workArea(viewport);
    set((state) => {
      let changed = false;
      const windows = state.windows.map((w) => {
        const width = Math.min(w.width, area.width);
        const height = Math.min(w.height, area.height);
        // Always leave a grabbable strip of title bar inside the work area.
        const x = clamp(w.x, area.left - width + MIN_ONSCREEN, area.left + area.width - MIN_ONSCREEN);
        const y = clamp(w.y, area.top, area.top + area.height - MENUBAR_HEIGHT);
        if (x === w.x && y === w.y && width === w.width && height === w.height) return w;
        changed = true;
        return { ...w, x, y, width, height };
      });
      return changed ? { windows } : {};
    });
  },
}));

/** Highest-z window that is not minimized, or null. */
function topmostVisibleId(windows: WindowInstance[]): string | null {
  const visible = windows.filter((w) => !w.minimized);
  if (visible.length === 0) return null;
  return visible.reduce((a, b) => (a.zIndex >= b.zIndex ? a : b)).instanceId;
}

/**
 * Keep z-indices from climbing forever. Once the dispenser passes the ceiling we
 * squash every window back down to a dense range starting at windowBase, keeping
 * relative order intact.
 */
function normalizeIfNeeded(
  set: (fn: (s: WindowStore) => Partial<WindowStore>) => void,
  get: () => WindowStore,
) {
  if (get().topZ < LAYERS.windowCeiling) return;
  set((state) => {
    const ordered = [...state.windows].sort((a, b) => a.zIndex - b.zIndex);
    const remap = new Map(
      ordered.map((w, i) => [w.instanceId, LAYERS.windowBase + i] as const),
    );
    return {
      windows: state.windows.map((w) => ({
        ...w,
        zIndex: remap.get(w.instanceId) ?? w.zIndex,
      })),
      topZ: LAYERS.windowBase + ordered.length,
    };
  });
}
