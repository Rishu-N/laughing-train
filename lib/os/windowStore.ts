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
import { LAYERS, MENUBAR_HEIGHT, DOCK_WIDTH } from './layers';
import { getApp } from './registry';
import type { OpenAppOptions, WindowInstance } from './types';

const DEFAULT_MIN_SIZE = { width: 240, height: 160 };

/** Each new cascaded window steps down-right by this much from the last. */
const CASCADE_STEP = 26;
const CASCADE_WRAP = 6;

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

    const size = opts?.size ?? def.defaultSize;
    const instanceId = nextInstanceId(appId);

    set((state) => {
      const z = state.topZ + 1;

      let position = opts?.position ?? def.defaultPosition;
      let cascadeIndex = state.cascadeIndex;
      if (!position) {
        const step = cascadeIndex % CASCADE_WRAP;
        position = {
          x: 60 + step * CASCADE_STEP,
          y: MENUBAR_HEIGHT + 24 + step * CASCADE_STEP,
        };
        cascadeIndex = cascadeIndex + 1;
      }

      const win: WindowInstance = {
        instanceId,
        appId,
        title: def.title,
        x: position.x,
        y: position.y,
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
        const vw = viewport?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 1280);
        const vh = viewport?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 800);
        return {
          ...w,
          maximized: true,
          restoreRect: { x: w.x, y: w.y, width: w.width, height: w.height },
          x: 0,
          y: MENUBAR_HEIGHT,
          width: Math.max(vw - DOCK_WIDTH, DEFAULT_MIN_SIZE.width),
          height: Math.max(vh - MENUBAR_HEIGHT, DEFAULT_MIN_SIZE.height),
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

  closeAll: () => set({ windows: [], focusedId: null }),
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
