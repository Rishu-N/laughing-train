'use client';

/**
 * The dock — every currently running window, as a tile. Right edge on desktop,
 * bottom bar below the mobile breakpoint.
 *
 * OWNER: OS Shell agent.
 *
 * Tile metrics live in ./dockGeometry so Window can aim its minimize animation
 * at the right slot. If you change the sizing here, change it there.
 */
import Image from 'next/image';
import { useCallback, useState } from 'react';
import { DOCK_HEIGHT_MOBILE, DOCK_WIDTH, LAYERS, MENUBAR_HEIGHT } from '@/lib/os/layers';
import { getApp } from '@/lib/os/registry';
import { useWindowStore } from '@/lib/os/windowStore';
import { DOCK_GAP, DOCK_PAD, DOCK_TILE, DOCK_TILE_MOBILE } from './dockGeometry';
import { useIsMobile } from './useIsMobile';

interface Tip {
  text: string;
  /** Viewport y of the tile's centre — the tip is vertically centred on it. */
  top: number;
}

export default function Dock() {
  const windows = useWindowStore((s) => s.windows);
  const focusedId = useWindowStore((s) => s.focusedId);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
  const restoreWindow = useWindowStore((s) => s.restoreWindow);
  const isMobile = useIsMobile();

  const [tip, setTip] = useState<Tip | null>(null);

  const showTip = useCallback(
    (e: React.SyntheticEvent<HTMLElement>, text: string) => {
      if (isMobile) return;
      const r = e.currentTarget.getBoundingClientRect();
      setTip({ text, top: r.top + r.height / 2 });
    },
    [isMobile],
  );
  const hideTip = useCallback(() => setTip(null), []);

  /**
   * Classic dock behaviour: an unfocused window comes forward, the focused one
   * gets out of the way, a collapsed one comes back.
   */
  const activate = useCallback(
    (instanceId: string, minimized: boolean, focused: boolean) => {
      if (minimized) restoreWindow(instanceId);
      else if (focused) minimizeWindow(instanceId);
      else focusWindow(instanceId);
    },
    [restoreWindow, minimizeWindow, focusWindow],
  );

  const tile = isMobile ? DOCK_TILE_MOBILE : DOCK_TILE;

  return (
    <div
      data-dock
      className={[
        'fixed flex border-os-ink bg-os-chrome',
        isMobile ? 'inset-x-0 bottom-0 border-t' : 'right-0 border-l',
      ].join(' ')}
      style={
        isMobile
          ? { height: DOCK_HEIGHT_MOBILE, zIndex: LAYERS.dock }
          : { top: MENUBAR_HEIGHT, bottom: 0, width: DOCK_WIDTH, zIndex: LAYERS.dock }
      }
      onPointerLeave={hideTip}
    >
      {/* Scroller. Hides its own scrollbar so tiles stay optically centred. */}
      <nav
        aria-label="Running applications"
        className={[
          'flex flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          isMobile
            ? 'flex-row items-center overflow-x-auto overflow-y-hidden'
            : 'flex-col items-center overflow-y-auto overflow-x-hidden',
        ].join(' ')}
        style={
          isMobile
            ? { gap: DOCK_GAP, paddingLeft: DOCK_PAD, paddingRight: DOCK_PAD }
            : { gap: DOCK_GAP, paddingTop: DOCK_PAD, paddingBottom: DOCK_PAD }
        }
      >
        {windows.length === 0 && (
          <p
            className={[
              'os-chrome-text text-center text-[9px] leading-tight text-os-ink-soft',
              isMobile ? 'self-center px-2' : 'px-1.5 pt-1',
            ].join(' ')}
          >
            No apps running
          </p>
        )}

        {windows.map((w) => {
          const def = getApp(w.appId);
          const focused = focusedId === w.instanceId && !w.minimized;
          const state = w.minimized ? ' (collapsed)' : focused ? ' (active)' : '';

          return (
            <button
              key={w.instanceId}
              type="button"
              aria-label={`${w.title}${state}`}
              aria-current={focused || undefined}
              onClick={() => activate(w.instanceId, w.minimized, focused)}
              onPointerEnter={(e) => showTip(e, `${w.title}${state}`)}
              onFocus={(e) => showTip(e, `${w.title}${state}`)}
              onBlur={hideTip}
              className={[
                'relative flex shrink-0 flex-col items-center justify-center gap-[3px] rounded-[4px] p-1',
                'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-os-accent',
                focused ? 'os-bevel-in' : 'os-bevel',
                w.minimized ? 'opacity-60' : '',
              ].join(' ')}
              style={{ width: tile, height: tile }}
            >
              {def?.icon ? (
                <Image
                  src={def.icon}
                  alt=""
                  width={isMobile ? 22 : 26}
                  height={isMobile ? 22 : 26}
                  className="pixelated shrink-0"
                />
              ) : (
                <span aria-hidden className="text-[16px] leading-none">
                  ▣
                </span>
              )}

              <span className="w-full truncate px-0.5 text-center text-[8px] leading-none os-chrome-text">
                {w.title}
              </span>

              {/* Running indicator, on the inner edge — a filled pip when the
                  window is on screen, a hollow one when it's collapsed. */}
              <span
                aria-hidden
                className={[
                  'absolute h-[4px] w-[4px] rounded-full border border-os-ink',
                  w.minimized ? 'bg-transparent' : 'bg-os-ink',
                  isMobile ? 'bottom-[1px] left-1/2 -translate-x-1/2' : 'left-[2px] top-1/2 -translate-y-1/2',
                ].join(' ')}
              />
            </button>
          );
        })}
      </nav>

      {/* Tooltip lives outside the scroller so it isn't clipped by overflow. */}
      {tip && !isMobile && (
        <div
          role="tooltip"
          className="os-window pointer-events-none fixed max-w-[220px] truncate rounded-[2px] px-2 py-[3px] text-[10px] leading-none os-chrome-text"
          style={{ top: tip.top, right: DOCK_WIDTH + 8, transform: 'translateY(-50%)' }}
        >
          {tip.text}
        </div>
      )}
    </div>
  );
}
