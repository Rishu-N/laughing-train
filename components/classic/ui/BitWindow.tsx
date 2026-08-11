'use client';

/**
 * A 1984 window: 1px outline, a lined title bar, and a close box. That's all.
 *
 * OWNER: Classic Boot agent.
 *
 * No zoom box, no size box, no collapse widget, no drop shadow — every one of
 * those is a later invention and their absence is most of what dates this
 * screen. Below CLASSIC_NARROW_BREAKPOINT the window stops being draggable and
 * becomes a near-full-width sheet so it still works at 375px.
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { BIT_FONT } from '@/components/classic/ui/Bit';
import { CLASSIC_MENUBAR_HEIGHT } from '@/lib/classic/metrics';

export interface BitWindowProps {
  title: string;
  /** Initial top-left, in px from the shell's top-left. Desktop layout only. */
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  /** Front-most window: only the active one gets the lined title bar. */
  active: boolean;
  narrow: boolean;
  onClose: () => void;
  onFocus: () => void;
  children: ReactNode;
}

/** Keep at least this much of the title bar reachable when dragging. */
const KEEP_VISIBLE = 72;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

export default function BitWindow({
  title,
  x,
  y,
  width,
  height,
  z,
  active,
  narrow,
  onClose,
  onFocus,
  children,
}: BitWindowProps) {
  const [pos, setPos] = useState({ x, y });
  const frameRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number; pointerId: number } | null>(null);

  // Opening a desk accessory hands it the keyboard, so Calculator digits and
  // Puzzle arrow keys work without the visitor hunting for a click target.
  useEffect(() => {
    bodyRef.current?.focus({ preventScroll: true });
  }, []);

  // A window dragged to the far edge and then a rotated phone must not become
  // unreachable.
  useEffect(() => {
    if (narrow) return;
    const onResize = () => {
      setPos((p) => ({
        x: clamp(p.x, KEEP_VISIBLE - width, window.innerWidth - KEEP_VISIBLE),
        y: clamp(p.y, CLASSIC_MENUBAR_HEIGHT, window.innerHeight - 28),
      }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [narrow, width]);

  const startDrag = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      onFocus();
      if (narrow || e.button !== 0) return;
      // The close box lives in the title bar; it must not start a drag.
      if ((e.target as HTMLElement).closest('button')) return;
      const rect = frameRef.current?.getBoundingClientRect();
      if (!rect) return;
      drag.current = {
        dx: e.clientX - rect.left,
        dy: e.clientY - rect.top,
        pointerId: e.pointerId,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [narrow, onFocus],
  );

  const onDrag = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    setPos({
      x: clamp(e.clientX - d.dx, KEEP_VISIBLE - width, window.innerWidth - KEEP_VISIBLE),
      y: clamp(e.clientY - d.dy, CLASSIC_MENUBAR_HEIGHT, window.innerHeight - 28),
    });
  }, [width]);

  const endDrag = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  /**
   * Escape closes the window — unless the accessory inside wanted it (the
   * Calculator uses Escape for Clear) and stopped the event on its way up.
   */
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  const geometry = narrow
    ? {
        left: 6,
        right: 6,
        top: CLASSIC_MENUBAR_HEIGHT + 6,
        // A definite height (not just a cap) so `flex-1` bodies and the
        // accessories' `h-full` roots have something to resolve against.
        height: `min(${height}px, calc(100% - ${CLASSIC_MENUBAR_HEIGHT + 12}px))`,
      }
    : {
        left: pos.x,
        top: pos.y,
        width,
        height,
        maxHeight: `calc(100% - ${CLASSIC_MENUBAR_HEIGHT + 8}px)`,
      };

  return (
    <div
      ref={frameRef}
      role="dialog"
      aria-label={title}
      data-classic-window={title}
      className={`${BIT_FONT} absolute flex flex-col border border-black bg-white text-black`}
      style={{ ...geometry, zIndex: z }}
      onPointerDown={onFocus}
    >
      <div
        className="relative flex h-[18px] shrink-0 items-center border-b border-black bg-white"
        style={{ cursor: narrow ? 'default' : 'move' }}
        onPointerDown={startDrag}
        onPointerMove={onDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* The six lines of an active title bar. Hard 1px stops — no blur. */}
        {active && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-[3px] h-[12px]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(to bottom, #000 0px, #000 1px, #fff 1px, #fff 3px)',
            }}
          />
        )}

        <div className="relative flex w-full items-center px-[3px]">
          <span className="bg-white px-[2px] leading-none">
            <button
              type="button"
              aria-label={`Close ${title}`}
              onClick={onClose}
              className="block h-[11px] w-[11px] cursor-default border border-black bg-white active:bg-black focus-visible:shadow-[inset_0_0_0_2px_#000] focus-visible:outline-none"
            />
          </span>
          <span className="mx-auto max-w-[68%] truncate bg-white px-[5px] text-[9px] leading-none select-none">
            {title}
          </span>
          <span aria-hidden="true" className="w-[15px] shrink-0" />
        </div>
      </div>

      <div
        ref={bodyRef}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="min-h-0 flex-1 overflow-auto bg-white outline-none"
      >
        {children}
      </div>
    </div>
  );
}
