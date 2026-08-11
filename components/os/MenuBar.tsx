'use client';

/**
 * Top menu bar with the logo dropdown on the RIGHT.
 *
 * OWNER: OS Shell agent. Phase 0 baseline — functional, not yet polished.
 */
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { bio } from '@/content/bio';
import { SYSTEM_IMAGES } from '@/content/images';
import { LAYERS, MENUBAR_HEIGHT } from '@/lib/os/layers';
import { allApps } from '@/lib/os/registry';
import { useWindowStore } from '@/lib/os/windowStore';
import { MenuHeading, MenuItem, MenuList, MenuSeparator } from './ui';

export default function MenuBar() {
  const [openMenu, setOpenMenu] = useState<'apps' | 'logo' | null>(null);
  const [clock, setClock] = useState('');
  const barRef = useRef<HTMLDivElement>(null);
  const openApp = useWindowStore((s) => s.openApp);

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      );
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);

  // Dismiss on outside click or Escape.
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: PointerEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenMenu(null);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenu]);

  const apps = allApps();

  return (
    <div
      ref={barRef}
      className="fixed inset-x-0 top-0 flex items-center gap-1 border-b border-os-ink bg-os-face px-2 os-chrome-text"
      style={{ height: MENUBAR_HEIGHT, zIndex: LAYERS.menuBar }}
    >
      {/* Apps menu, left. */}
      <div className="relative">
        <button
          type="button"
          className={`rounded-[2px] px-2 py-0.5 text-[11px] ${openMenu === 'apps' ? 'bg-os-accent text-white' : ''}`}
          onClick={() => setOpenMenu((m) => (m === 'apps' ? null : 'apps'))}
        >
          Apps
        </button>
        {openMenu === 'apps' && (
          <div className="absolute left-0 top-full pt-1" style={{ zIndex: LAYERS.menuPopover }}>
            <MenuList>
              {apps.length === 0 && <MenuItem disabled>No apps registered</MenuItem>}
              {apps.map((a) => (
                <MenuItem
                  key={a.id}
                  onSelect={() => {
                    openApp(a.id);
                    setOpenMenu(null);
                  }}
                >
                  {a.title}
                </MenuItem>
              ))}
            </MenuList>
          </div>
        )}
      </div>

      <div className="flex-1" />

      <span className="px-2 text-[10px] text-os-ink-soft">{clock}</span>

      {/* Logo menu, right — About Me and socials. */}
      <div className="relative">
        <button
          type="button"
          aria-label="About this Macintosh"
          className={`flex items-center rounded-[2px] px-1.5 py-0.5 ${openMenu === 'logo' ? 'bg-os-accent' : ''}`}
          onClick={() => setOpenMenu((m) => (m === 'logo' ? null : 'logo'))}
        >
          <Image
            src={SYSTEM_IMAGES.logo}
            alt=""
            width={16}
            height={16}
            className="pixelated"
            priority
          />
        </button>
        {openMenu === 'logo' && (
          <div className="absolute right-0 top-full pt-1" style={{ zIndex: LAYERS.menuPopover }}>
            <MenuList>
              <MenuHeading>{bio.name}</MenuHeading>
              <MenuItem
                onSelect={() => {
                  openApp('browser');
                  setOpenMenu(null);
                }}
              >
                About Me…
              </MenuItem>
              <MenuSeparator />
              <MenuHeading>Elsewhere</MenuHeading>
              {bio.socials.map((s) => (
                <MenuItem key={s.url} href={s.url} hint={s.handle} onSelect={() => setOpenMenu(null)}>
                  {s.label}
                </MenuItem>
              ))}
            </MenuList>
          </div>
        )}
      </div>
    </div>
  );
}
