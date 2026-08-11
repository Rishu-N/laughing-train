'use client';

/**
 * The dock — lists currently running apps. Right edge on desktop, bottom on mobile.
 *
 * OWNER: OS Shell agent. Phase 0 baseline.
 */
import Image from 'next/image';
import { DOCK_HEIGHT_MOBILE, DOCK_WIDTH, LAYERS, MENUBAR_HEIGHT } from '@/lib/os/layers';
import { getApp } from '@/lib/os/registry';
import { useWindowStore } from '@/lib/os/windowStore';
import { useIsMobile } from './useIsMobile';

export default function Dock() {
  const windows = useWindowStore((s) => s.windows);
  const focusedId = useWindowStore((s) => s.focusedId);
  const toggleMinimize = useWindowStore((s) => s.toggleMinimize);
  const restoreWindow = useWindowStore((s) => s.restoreWindow);
  const isMobile = useIsMobile();

  return (
    <div
      aria-label="Dock"
      className={[
        'fixed flex border-os-ink bg-os-chrome/95',
        isMobile
          ? 'inset-x-0 bottom-0 flex-row items-center gap-2 overflow-x-auto border-t px-2'
          : 'right-0 flex-col items-center gap-2 border-l py-2',
      ].join(' ')}
      style={
        isMobile
          ? { height: DOCK_HEIGHT_MOBILE, zIndex: LAYERS.dock }
          : { top: MENUBAR_HEIGHT, bottom: 0, width: DOCK_WIDTH, zIndex: LAYERS.dock }
      }
    >
      {windows.length === 0 && !isMobile && (
        <span className="px-2 pt-1 text-center text-[9px] leading-tight text-os-ink-soft os-chrome-text">
          No apps running
        </span>
      )}

      {windows.map((w) => {
        const def = getApp(w.appId);
        const active = focusedId === w.instanceId && !w.minimized;
        return (
          <button
            key={w.instanceId}
            type="button"
            title={`${w.title}${w.minimized ? ' (minimized)' : ''}`}
            aria-label={`${w.title}${w.minimized ? ', minimized' : ''}`}
            onClick={() => (w.minimized ? restoreWindow(w.instanceId) : toggleMinimize(w.instanceId))}
            className={[
              'relative flex h-[52px] w-[52px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[4px] p-1',
              active ? 'os-bevel-in' : 'os-bevel',
              w.minimized ? 'opacity-55' : '',
            ].join(' ')}
          >
            {def?.icon ? (
              <Image src={def.icon} alt="" width={24} height={24} className="pixelated" />
            ) : (
              <span aria-hidden className="text-[16px] leading-none">
                ▣
              </span>
            )}
            <span className="w-full truncate text-center text-[8px] leading-none os-chrome-text">
              {w.title}
            </span>
            {/* Running indicator. */}
            <span
              aria-hidden
              className="absolute bottom-0.5 h-[3px] w-[3px] rounded-full bg-os-ink"
            />
          </button>
        );
      })}
    </div>
  );
}
