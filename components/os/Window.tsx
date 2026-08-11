'use client';

/**
 * A single System 7 window frame: pinstriped title bar, close box on the left,
 * collapse + zoom boxes on the right, a bottom-right resize grip, and the
 * genie-lite minimize that flies the window toward its dock tile.
 *
 * OWNER: OS Shell agent.
 *
 * Coordinates in the store are VIEWPORT coordinates. The window layer in
 * Desktop is a full-bleed, pointer-events-none container, so `left`/`top` here
 * map 1:1 onto the numbers the store holds — which is what makes the dock
 * geometry maths below work without measuring anything.
 */
import { motion } from 'framer-motion';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { DOCK_HEIGHT_MOBILE, DOCK_WIDTH, MENUBAR_HEIGHT } from '@/lib/os/layers';
import { getApp } from '@/lib/os/registry';
import { useWindowStore } from '@/lib/os/windowStore';
import type { WindowInstance } from '@/lib/os/types';
import { dockSlotRect } from './dockGeometry';
import { useIsMobile, useViewport } from './useIsMobile';

/** Keep at least this much of the title bar reachable so a window can't be lost. */
const MIN_VISIBLE = 96;
const DEFAULT_MIN_SIZE = { width: 240, height: 160 };

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

function Window({ win }: { win: WindowInstance }) {
  const def = getApp(win.appId);
  const isMobile = useIsMobile();
  const viewport = useViewport();

  const focusWindow = useWindowStore((s) => s.focusWindow);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
  const toggleMaximize = useWindowStore((s) => s.toggleMaximize);
  const moveWindow = useWindowStore((s) => s.moveWindow);
  const resizeWindow = useWindowStore((s) => s.resizeWindow);
  const setTitle = useWindowStore((s) => s.setTitle);
  const isFocused = useWindowStore((s) => s.focusedId === win.instanceId);
  // Which dock tile this window collapses into.
  const dockIndex = useWindowStore((s) =>
    s.windows.findIndex((w) => w.instanceId === win.instanceId),
  );

  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const origin = useRef({ px: 0, py: 0, x: 0, y: 0, w: 0, h: 0 });

  /* ── geometry ──────────────────────────────────────────────────────────── */

  // Below the breakpoint every window is the screen: no drag, no resize, no zoom.
  const rect = isMobile
    ? {
        left: 0,
        top: MENUBAR_HEIGHT,
        width: viewport.width,
        height: Math.max(viewport.height - MENUBAR_HEIGHT - DOCK_HEIGHT_MOBILE, 220),
      }
    : { left: win.x, top: win.y, width: win.width, height: win.height };

  const bounds = useMemo(() => {
    const rightEdge = viewport.width - (isMobile ? 0 : DOCK_WIDTH);
    const bottomEdge = viewport.height - (isMobile ? DOCK_HEIGHT_MOBILE : 0);
    return {
      minX: MIN_VISIBLE - win.width,
      maxX: Math.max(MIN_VISIBLE - win.width, rightEdge - MIN_VISIBLE),
      minY: MENUBAR_HEIGHT,
      maxY: Math.max(MENUBAR_HEIGHT, bottomEdge - MENUBAR_HEIGHT),
    };
  }, [viewport.width, viewport.height, isMobile, win.width]);

  /* ── drag ──────────────────────────────────────────────────────────────── */

  const draggable = !isMobile && !win.maximized;

  const onTitlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      focusWindow(win.instanceId);
      if (!draggable || e.button !== 0) return;
      // Never start a drag from the close / collapse / zoom boxes.
      if ((e.target as HTMLElement).closest('[data-window-control]')) return;
      // Suppresses the text-selection drag the browser would otherwise start.
      e.preventDefault();
      origin.current = { px: e.clientX, py: e.clientY, x: win.x, y: win.y, w: 0, h: 0 };
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [draggable, win.instanceId, win.x, win.y, focusWindow],
  );

  const onTitlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      moveWindow(
        win.instanceId,
        clamp(origin.current.x + (e.clientX - origin.current.px), bounds.minX, bounds.maxX),
        clamp(origin.current.y + (e.clientY - origin.current.py), bounds.minY, bounds.maxY),
      );
    },
    [dragging, win.instanceId, bounds, moveWindow],
  );

  /* ── resize ────────────────────────────────────────────────────────────── */

  const resizable = def?.resizable !== false && !isMobile && !win.maximized;
  const minSize = def?.minSize ?? DEFAULT_MIN_SIZE;

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      focusWindow(win.instanceId);
      origin.current = { px: e.clientX, py: e.clientY, x: 0, y: 0, w: win.width, h: win.height };
      setResizing(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [win.instanceId, win.width, win.height, focusWindow],
  );

  const onResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!resizing) return;
      // Clamped so the grip can't be dragged past the edge of the desktop.
      const maxW = viewport.width - (isMobile ? 0 : DOCK_WIDTH) - win.x;
      const maxH = viewport.height - (isMobile ? DOCK_HEIGHT_MOBILE : 0) - win.y;
      resizeWindow(
        win.instanceId,
        clamp(origin.current.w + (e.clientX - origin.current.px), minSize.width, Math.max(minSize.width, maxW)),
        clamp(origin.current.h + (e.clientY - origin.current.py), minSize.height, Math.max(minSize.height, maxH)),
      );
    },
    [resizing, win.instanceId, win.x, win.y, viewport, isMobile, minSize, resizeWindow],
  );

  const endGesture = useCallback((e: React.PointerEvent) => {
    setDragging(false);
    setResizing(false);
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  /* ── the app itself ────────────────────────────────────────────────────── */

  const handleSetTitle = useCallback(
    (t: string) => setTitle(win.instanceId, t),
    [setTitle, win.instanceId],
  );
  const handleClose = useCallback(
    () => closeWindow(win.instanceId),
    [closeWindow, win.instanceId],
  );

  const AppComponent = def?.component;
  // Memoized so a 60fps drag re-renders the frame only — the app subtree (which
  // may be a canvas, a grid or a terminal) is untouched while the window moves.
  const content = useMemo(
    () =>
      AppComponent ? (
        <AppComponent
          instanceId={win.instanceId}
          appId={win.appId}
          params={win.params}
          setTitle={handleSetTitle}
          close={handleClose}
        />
      ) : null,
    [AppComponent, win.instanceId, win.appId, win.params, handleSetTitle, handleClose],
  );

  /* ── minimize target ───────────────────────────────────────────────────── */

  // Transform origin is the top-left corner, so translate-then-scale maps the
  // window rect exactly onto the dock tile rect. That is the whole genie trick.
  const genie = useMemo(() => {
    if (!win.minimized) return null;
    const tile = dockSlotRect(dockIndex, isMobile, viewport);
    return {
      x: tile.left - rect.left,
      y: tile.top - rect.top,
      scaleX: Math.max(tile.width / Math.max(rect.width, 1), 0.02),
      scaleY: Math.max(tile.height / Math.max(rect.height, 1), 0.02),
      opacity: 0,
    };
  }, [win.minimized, dockIndex, isMobile, viewport, rect.left, rect.top, rect.width, rect.height]);

  if (!def) return null;

  const gesturing = dragging || resizing;

  return (
    <motion.div
      role="dialog"
      aria-label={win.title}
      // Collapsed windows stay mounted (apps keep their state) but must drop
      // out of the tab order and the accessibility tree entirely.
      inert={win.minimized}
      data-window={win.instanceId}
      data-focused={isFocused || undefined}
      initial={{ opacity: 0, scaleX: 0.94, scaleY: 0.94 }}
      animate={genie ?? { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1 }}
      exit={{ opacity: 0, scaleX: 0.9, scaleY: 0.9, transition: { duration: 0.12 } }}
      transition={
        gesturing
          ? { duration: 0 }
          : { duration: win.minimized ? 0.26 : 0.2, ease: [0.22, 0.61, 0.36, 1] }
      }
      className="absolute flex flex-col overflow-hidden border border-os-ink bg-os-face"
      style={{
        ...rect,
        zIndex: win.zIndex,
        transformOrigin: 'top left',
        pointerEvents: win.minimized ? 'none' : 'auto',
        // Focused windows sit on a heavier hard shadow; unfocused recede.
        boxShadow: isFocused ? '3px 3px 0 0 rgb(0 0 0 / 0.55)' : '1px 1px 0 0 rgb(0 0 0 / 0.3)',
      }}
      onPointerDown={() => focusWindow(win.instanceId)}
    >
      {/* ── title bar ─────────────────────────────────────────────────────── */}
      <div
        className={[
          'relative flex h-[var(--spacing-titlebar)] shrink-0 select-none items-center gap-1',
          'border-b border-os-ink bg-os-chrome px-1 os-chrome-text',
          draggable ? 'cursor-move' : '',
        ].join(' ')}
        style={{ touchAction: 'none' }}
        onPointerDown={onTitlePointerDown}
        onPointerMove={onTitlePointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onDoubleClick={() => {
          if (!isMobile) toggleMaximize(win.instanceId, viewport);
        }}
      >
        {/* Pinstripes only when active — the System 7 focus cue. */}
        {isFocused && (
          <div
            aria-hidden
            className="os-pinstripe pointer-events-none absolute inset-x-[3px] inset-y-[3px] opacity-70"
          />
        )}

        <TitleBox label={`Close ${win.title}`} onClick={() => closeWindow(win.instanceId)}>
          <span
            aria-hidden
            className="block h-[3px] w-[3px] bg-os-ink opacity-0 transition-opacity group-hover:opacity-100"
          />
        </TitleBox>

        {/* Centered title on a chrome plate that masks the pinstripes. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            className={[
              'max-w-[calc(100%-80px)] truncate bg-os-chrome px-2 text-[10px] leading-none',
              isFocused ? 'text-os-ink' : 'text-os-disabled',
            ].join(' ')}
          >
            {win.title}
          </span>
        </div>

        <div className="flex-1" />

        <TitleBox label={`Collapse ${win.title}`} onClick={() => minimizeWindow(win.instanceId)}>
          <span aria-hidden className="block h-[1px] w-[6px] bg-os-ink" />
        </TitleBox>

        {!isMobile && (
          <TitleBox
            label={`Zoom ${win.title}`}
            onClick={() => toggleMaximize(win.instanceId, viewport)}
          >
            <span aria-hidden className="absolute left-[1px] top-[1px] h-[4px] w-[4px] border border-os-ink" />
          </TitleBox>
        )}
      </div>

      {/* ── app content ───────────────────────────────────────────────────── */}
      <div
        className="min-h-0 flex-1 overflow-hidden"
        // A drag must never let the pointer fall into the app underneath.
        style={gesturing ? { pointerEvents: 'none', userSelect: 'none' } : undefined}
      >
        {content}
      </div>

      {/* ── resize grip ───────────────────────────────────────────────────── */}
      {resizable && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize window"
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={endGesture}
          onPointerCancel={endGesture}
          className="absolute bottom-0 right-0 h-[15px] w-[15px] cursor-se-resize border-l border-t border-os-ink bg-os-chrome"
          style={{
            touchAction: 'none',
            backgroundImage:
              'linear-gradient(135deg, transparent 40%, var(--color-os-ink) 40%, var(--color-os-ink) 50%, transparent 50%, transparent 66%, var(--color-os-ink) 66%, var(--color-os-ink) 76%, transparent 76%)',
          }}
        />
      )}
    </motion.div>
  );
}

/**
 * One of the little 11px boxes in the title bar. Kept local: these are window
 * chrome, not a general-purpose control, so they don't belong in os/ui.
 */
function TitleBox({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      data-window-control
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="group relative z-10 flex h-[11px] w-[11px] shrink-0 items-center justify-center border border-os-ink bg-os-chrome active:bg-os-ink"
    >
      {children}
    </button>
  );
}

export default memo(Window);

export { DOCK_WIDTH };
