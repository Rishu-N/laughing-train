'use client';

/**
 * The desktop — the root of the entire OS. One route, everything else is a window.
 *
 * OWNER: OS Shell agent. Phase 0 baseline.
 */
import { AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { SYSTEM_IMAGES } from '@/content/images';
import { DOCK_HEIGHT_MOBILE, DOCK_WIDTH, MENUBAR_HEIGHT } from '@/lib/os/layers';
import { DEFAULT_APP_ID, desktopApps, getApp } from '@/lib/os/registry';
import { useWindowStore } from '@/lib/os/windowStore';
import BootSequence from './BootSequence';
import Dock from './Dock';
import MenuBar from './MenuBar';
import Window from './Window';
import { useIsMobile } from './useIsMobile';

export default function Desktop() {
  const [booted, setBooted] = useState(false);
  const windows = useWindowStore((s) => s.windows);
  const openApp = useWindowStore((s) => s.openApp);
  const isMobile = useIsMobile();
  const openedDefault = useRef(false);

  // The Browser opens automatically once the boot overlay clears — this is the
  // "OS resuming your session" beat, and it is why window layout is never
  // persisted. Guarded by a ref so React strict-mode double-effects don't
  // open it twice.
  useEffect(() => {
    if (!booted || openedDefault.current) return;
    openedDefault.current = true;
    if (getApp(DEFAULT_APP_ID)) openApp(DEFAULT_APP_ID);
  }, [booted, openApp]);

  const icons = desktopApps();

  return (
    <div
      className="relative h-dvh w-screen overflow-hidden"
      style={{
        backgroundColor: 'var(--color-os-desktop)',
        backgroundImage: `url(${SYSTEM_IMAGES.desktopPattern})`,
        backgroundRepeat: 'repeat',
      }}
    >
      <BootSequence onDone={() => setBooted(true)} />
      <MenuBar />

      {/* Desktop icons, top-left under the menu bar. */}
      <div
        className="absolute left-0 flex flex-col flex-wrap gap-1 p-2"
        style={{ top: MENUBAR_HEIGHT }}
      >
        {icons.map((app) => (
          <button
            key={app.id}
            type="button"
            onDoubleClick={() => openApp(app.id)}
            onClick={(e) => {
              // Single tap opens on touch devices, where dblclick is awkward.
              if (e.detail === 0 || isMobile) openApp(app.id);
            }}
            title={app.description ?? app.title}
            className="flex w-[76px] flex-col items-center gap-1 rounded-[3px] p-1 focus:bg-os-accent/30 focus:outline-none"
          >
            <Image src={app.icon} alt="" width={32} height={32} className="pixelated" />
            <span className="w-full break-words bg-os-face/85 px-1 text-center text-[9px] leading-tight os-chrome-text">
              {app.title}
            </span>
          </button>
        ))}
      </div>

      {/* Window layer. */}
      <div
        className="absolute inset-0"
        style={{
          top: MENUBAR_HEIGHT,
          right: isMobile ? 0 : DOCK_WIDTH,
          bottom: isMobile ? DOCK_HEIGHT_MOBILE : 0,
        }}
      >
        <AnimatePresence>
          {windows
            .filter((w) => !w.minimized)
            .map((w) => (
              <Window key={w.instanceId} win={w} />
            ))}
        </AnimatePresence>
      </div>

      <Dock />
    </div>
  );
}
