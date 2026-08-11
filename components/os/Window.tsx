'use client';

/**
 * A single draggable, resizable window frame.
 *
 * OWNER: OS Shell agent. This Phase 0 version is functional but unpolished —
 * the shell agent owns the animation, chrome detailing and mobile behaviour.
 */
import { motion } from 'framer-motion';
import { useCallback, useRef, useState } from 'react';
import { MENUBAR_HEIGHT, DOCK_WIDTH } from '@/lib/os/layers';
import { getApp } from '@/lib/os/registry';
import { useWindowStore } from '@/lib/os/windowStore';
import type { WindowInstance } from '@/lib/os/types';
import { useIsMobile, useViewport } from './useIsMobile';

/** Keep at least this much of the title bar on screen so a window can't be lost. */
const MIN_VISIBLE = 80;

export default function Window({ win }: { win: WindowInstance }) {
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
  const focusedId = useWindowStore((s) => s.focusedId);

  const isFocused = focusedId === win.instanceId;
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const origin = useRef({ px: 0, py: 0, x: 0, y: 0, w: 0, h: 0 });

  const onTitlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isMobile || win.maximized) return;
      // Ignore clicks that land on the close/zoom boxes.
      if ((e.target as HTMLElement).closest('[data-window-control]')) return;
      e.preventDefault();
      focusWindow(win.instanceId);
      origin.current = { px: e.clientX, py: e.clientY, x: win.x, y: win.y, w: 0, h: 0 };
      setDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [isMobile, win.maximized, win.instanceId, win.x, win.y, focusWindow],
  );

  const onTitlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - origin.current.px;
      const dy = e.clientY - origin.current.py;
      const nextX = Math.min(
        Math.max(origin.current.x + dx, MIN_VISIBLE - win.width),
        viewport.width - MIN_VISIBLE,
      );
      const nextY = Math.min(
        Math.max(origin.current.y + dy, MENUBAR_HEIGHT),
        viewport.height - MIN_VISIBLE,
      );
      moveWindow(win.instanceId, nextX, nextY);
    },
    [dragging, win.instanceId, win.width, viewport, moveWindow],
  );

  const endDrag = useCallback(() => {
    setDragging(false);
    setResizing(false);
  }, []);

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      focusWindow(win.instanceId);
      origin.current = {
        px: e.clientX,
        py: e.clientY,
        x: 0,
        y: 0,
        w: win.width,
        h: win.height,
      };
      setResizing(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [win.instanceId, win.width, win.height, focusWindow],
  );

  const onResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!resizing) return;
      resizeWindow(
        win.instanceId,
        origin.current.w + (e.clientX - origin.current.px),
        origin.current.h + (e.clientY - origin.current.py),
      );
    },
    [resizing, win.instanceId, resizeWindow],
  );

  if (!def) return null;
  const AppComponent = def.component;

  // Mobile: every window fills the available area; drag and resize are off.
  const rect = isMobile
    ? {
        left: 0,
        top: MENUBAR_HEIGHT,
        width: viewport.width,
        height: Math.max(viewport.height - MENUBAR_HEIGHT - 64, 200),
      }
    : { left: win.x, top: win.y, width: win.width, height: win.height };

  const resizable = def.resizable !== false && !isMobile && !win.maximized;

  return (
    <motion.div
      role="dialog"
      aria-label={win.title}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      className="os-window absolute flex flex-col overflow-hidden"
      style={{ ...rect, zIndex: win.zIndex }}
      onPointerDown={() => focusWindow(win.instanceId)}
    >
      {/* ── title bar ─────────────────────────────────────────────────── */}
      <div
        className={[
          'relative flex h-[var(--spacing-titlebar)] shrink-0 items-center gap-1 border-b border-os-ink bg-os-chrome px-1',
          isMobile || win.maximized ? '' : 'cursor-move',
        ].join(' ')}
        onPointerDown={onTitlePointerDown}
        onPointerMove={onTitlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => !isMobile && toggleMaximize(win.instanceId, viewport)}
      >
        {/* close box */}
        <button
          data-window-control
          type="button"
          aria-label={`Close ${win.title}`}
          onClick={() => closeWindow(win.instanceId)}
          className="z-10 h-[11px] w-[11px] shrink-0 border border-os-ink bg-os-chrome active:bg-os-ink"
        />

        {/* pinstripes + centered title */}
        <div className="pointer-events-none absolute inset-x-0 flex h-full items-center justify-center px-7">
          {isFocused && (
            <div aria-hidden className="os-pinstripe absolute inset-x-7 top-1/2 h-[9px] -translate-y-1/2 opacity-40" />
          )}
          <span
            className={[
              'relative max-w-[70%] truncate bg-os-chrome px-2 text-[10px] os-chrome-text',
              isFocused ? 'text-os-ink' : 'text-os-disabled',
            ].join(' ')}
          >
            {win.title}
          </span>
        </div>

        <div className="flex-1" />

        {/* minimize + zoom */}
        <button
          data-window-control
          type="button"
          aria-label={`Minimize ${win.title}`}
          onClick={() => minimizeWindow(win.instanceId)}
          className="z-10 h-[11px] w-[11px] shrink-0 border border-os-ink bg-os-chrome active:bg-os-ink"
        />
        {!isMobile && (
          <button
            data-window-control
            type="button"
            aria-label={`Zoom ${win.title}`}
            onClick={() => toggleMaximize(win.instanceId, viewport)}
            className="z-10 h-[11px] w-[11px] shrink-0 border border-os-ink bg-os-chrome active:bg-os-ink"
          />
        )}
      </div>

      {/* ── app content ───────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <AppComponent
          instanceId={win.instanceId}
          appId={win.appId}
          params={win.params}
          setTitle={(t) => setTitle(win.instanceId, t)}
          close={() => closeWindow(win.instanceId)}
        />
      </div>

      {/* ── resize grip ───────────────────────────────────────────────── */}
      {resizable && (
        <div
          role="separator"
          aria-label="Resize window"
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize bg-os-chrome"
          style={{
            backgroundImage:
              'linear-gradient(135deg, transparent 45%, var(--color-os-ink) 45%, var(--color-os-ink) 52%, transparent 52%, transparent 70%, var(--color-os-ink) 70%, var(--color-os-ink) 77%, transparent 77%)',
          }}
        />
      )}
    </motion.div>
  );
}

export { DOCK_WIDTH };
