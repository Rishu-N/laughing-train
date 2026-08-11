'use client';

/**
 * The desktop — the root of the entire OS. One route; everything else is a window.
 *
 * OWNER: OS Shell agent.
 *
 * Layering, bottom to top: pattern surface (click target for defocus) → desktop
 * icons → window layer → dock → menu bar → boot overlay. The window layer is
 * pointer-events-none so clicks in empty space fall through to the surface.
 */
import { AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SYSTEM_IMAGES } from '@/content/images';
import { MENUBAR_HEIGHT } from '@/lib/os/layers';
import { DEFAULT_APP_ID, desktopApps, getApp } from '@/lib/os/registry';
import { useWindowStore } from '@/lib/os/windowStore';
import type { AppDefinition } from '@/lib/os/types';
import BootSequence from './BootSequence';
import Dock from './Dock';
import MenuBar from './MenuBar';
import Window from './Window';
import { useIsMobile, useViewport } from './useIsMobile';

export default function Desktop() {
  const [booted, setBooted] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);

  const windows = useWindowStore((s) => s.windows);
  const openApp = useWindowStore((s) => s.openApp);
  const defocusAll = useWindowStore((s) => s.defocusAll);
  const clampToViewport = useWindowStore((s) => s.clampToViewport);

  const isMobile = useIsMobile();
  const viewport = useViewport();
  const openedDefault = useRef(false);

  // Stable so BootSequence's one-shot timer effect is never restarted.
  const handleBooted = useCallback(() => setBooted(true), []);

  // The Browser opens automatically once the boot overlay clears — this is the
  // "OS resuming your session" beat, and it is why window layout is never
  // persisted. Guarded by a ref so strict-mode double-effects don't open twice.
  useEffect(() => {
    if (!booted || openedDefault.current) return;
    openedDefault.current = true;
    if (getApp(DEFAULT_APP_ID)) openApp(DEFAULT_APP_ID);
  }, [booted, openApp]);

  // Shrinking the browser window must never strand a window off-screen.
  useEffect(() => {
    clampToViewport(viewport);
  }, [viewport, clampToViewport]);

  /** Clicking bare desktop deselects icons and drops window focus. */
  const onSurfacePointerDown = useCallback(() => {
    setSelectedIcon(null);
    defocusAll();
  }, [defocusAll]);

  const icons = desktopApps();

  return (
    <div
      className="relative h-dvh w-screen overflow-hidden"
      style={{
        backgroundColor: 'var(--color-os-desktop)',
        backgroundImage: `url(${SYSTEM_IMAGES.desktopPattern})`,
        backgroundRepeat: 'repeat',
        // Scaled up from the 4px source so the dither reads as a 90s pattern
        // rather than as flat colour.
        backgroundSize: '8px 8px',
      }}
    >
      {/* Bare desktop: the defocus click target, behind everything else. */}
      <div
        className="absolute inset-0"
        onPointerDown={onSurfacePointerDown}
        aria-hidden
      />

      {/* Desktop icons, top-left under the menu bar, wrapping into columns. */}
      <div
        className="pointer-events-none absolute left-0 flex flex-col flex-wrap content-start gap-1 p-2"
        style={{
          top: MENUBAR_HEIGHT,
          maxHeight: Math.max(viewport.height - MENUBAR_HEIGHT - (isMobile ? 72 : 8), 120),
        }}
      >
        {icons.map((app) => (
          <DesktopIcon
            key={app.id}
            app={app}
            selected={selectedIcon === app.id}
            onSelect={() => setSelectedIcon(app.id)}
            onOpen={() => {
              setSelectedIcon(app.id);
              openApp(app.id);
            }}
            openOnSingleClick={isMobile}
          />
        ))}
      </div>

      {/* Window layer. Transparent to pointers so bare desktop stays clickable;
          each window re-enables them for itself. */}
      <div className="pointer-events-none absolute inset-0">
        <AnimatePresence>
          {windows.map((w) => (
            <Window key={w.instanceId} win={w} />
          ))}
        </AnimatePresence>
      </div>

      <Dock />
      <MenuBar />
      <BootSequence onDone={handleBooted} />
    </div>
  );
}

/**
 * One desktop icon. Double-click to open on a mouse; a single tap opens on
 * touch, where a double-tap is both awkward and easy to mistake for a zoom.
 */
function DesktopIcon({
  app,
  selected,
  onSelect,
  onOpen,
  openOnSingleClick,
}: {
  app: AppDefinition;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  openOnSingleClick: boolean;
}) {
  return (
    <button
      type="button"
      title={app.description ?? app.title}
      aria-label={app.description ? `${app.title} — ${app.description}` : app.title}
      onClick={(e) => {
        onSelect();
        // detail === 0 means the click came from the keyboard.
        if (e.detail === 0 || openOnSingleClick) onOpen();
      }}
      onDoubleClick={onOpen}
      className={[
        'pointer-events-auto flex w-[76px] shrink-0 flex-col items-center gap-1 rounded-[3px] p-1 text-center',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-os-face',
      ].join(' ')}
    >
      <span className="relative block h-8 w-8">
        <Image src={app.icon} alt="" width={32} height={32} className="pixelated" />
        {/* System 7 selects an icon by darkening it. */}
        {selected && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-[2px] bg-os-accent mix-blend-multiply opacity-60"
          />
        )}
      </span>
      <span
        className={[
          'w-full break-words rounded-[1px] px-1 text-[9px] leading-tight os-chrome-text',
          selected ? 'bg-os-ink text-os-face' : 'bg-os-face/85 text-os-ink',
        ].join(' ')}
      >
        {app.title}
      </span>
    </button>
  );
}
