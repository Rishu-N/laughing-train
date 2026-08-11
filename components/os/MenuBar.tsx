'use client';

/**
 * The menu bar. Apps menu on the left, clock and the logo dropdown on the right.
 *
 * OWNER: OS Shell agent.
 *
 * Everything in the logo menu comes from content/bio.ts — the menu is a view,
 * never a place to type a name or a URL.
 */
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { bio } from '@/content/bio';
import { SYSTEM_IMAGES } from '@/content/images';
import { LAYERS, MENUBAR_HEIGHT } from '@/lib/os/layers';
import { DEFAULT_APP_ID, allApps, getApp } from '@/lib/os/registry';
import { useStageStore } from '@/lib/os/stageStore';
import { useWindowStore } from '@/lib/os/windowStore';
import type { AppCategory } from '@/lib/os/types';
import { MenuHeading, MenuItem, MenuList, MenuSeparator } from './ui';

type MenuId = 'apps' | 'logo';

/** Order and labels for the Apps menu groups. Chrome copy, not content. */
const CATEGORY_ORDER: { key: AppCategory; label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'creative', label: 'Creative' },
  { key: 'project', label: 'Projects' },
  { key: 'game', label: 'Games' },
];

const ABOUT_APP_ID = 'about';

export default function MenuBar() {
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const [clock, setClock] = useState('');
  const barRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const appsBtn = useRef<HTMLButtonElement>(null);
  const logoBtn = useRef<HTMLButtonElement>(null);

  const openApp = useWindowStore((s) => s.openApp);
  const closeAll = useWindowStore((s) => s.closeAll);
  const restart = useStageStore((s) => s.restart);
  const runningAppIds = useWindowStore((s) => s.windows.map((w) => w.appId).join(','));

  /* ── clock ─────────────────────────────────────────────────────────────── */

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(
        `${now.toLocaleDateString([], { weekday: 'short' })} ${now.toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
        })}`,
      );
    };
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);

  /* ── open / close plumbing ─────────────────────────────────────────────── */

  const close = useCallback((restoreFocus: MenuId | null = null) => {
    setOpenMenu(null);
    if (restoreFocus === 'apps') appsBtn.current?.focus();
    if (restoreFocus === 'logo') logoBtn.current?.focus();
  }, []);

  // Dismiss on outside pointerdown or Escape anywhere.
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: PointerEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(openMenu);
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenu, close]);

  /** Enabled menu items in the open popover, in DOM order. */
  const menuItems = useCallback(
    () =>
      Array.from(
        popRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
      ).filter((el) => !el.hasAttribute('disabled')),
    [],
  );

  // Opening a menu moves focus into it, which is what makes arrow keys work.
  useEffect(() => {
    if (!openMenu) return;
    menuItems()[0]?.focus();
  }, [openMenu, menuItems]);

  const onMenuKeyDown = useCallback(
    (e: React.KeyboardEvent, id: MenuId) => {
      if (e.key === 'ArrowDown' && openMenu !== id) {
        e.preventDefault();
        setOpenMenu(id);
        return;
      }
      if (openMenu !== id) return;

      const items = menuItems();
      if (items.length === 0) return;
      const at = items.indexOf(document.activeElement as HTMLElement);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          items[(at + 1 + items.length) % items.length]?.focus();
          break;
        case 'ArrowUp':
          e.preventDefault();
          items[(at - 1 + items.length) % items.length]?.focus();
          break;
        case 'Home':
          e.preventDefault();
          items[0]?.focus();
          break;
        case 'End':
          e.preventDefault();
          items[items.length - 1]?.focus();
          break;
        case 'ArrowLeft':
        case 'ArrowRight':
          // Walk between the two menus the way a real menu bar does.
          e.preventDefault();
          setOpenMenu(id === 'apps' ? 'logo' : 'apps');
          break;
        case 'Tab':
          close(id);
          break;
      }
    },
    [openMenu, menuItems, close],
  );

  /* ── data ──────────────────────────────────────────────────────────────── */

  const apps = allApps();
  const grouped = CATEGORY_ORDER.map((c) => ({
    ...c,
    items: apps.filter((a) => a.category === c.key),
  })).filter((g) => g.items.length > 0);

  const running = new Set(runningAppIds ? runningAppIds.split(',') : []);
  const hasAbout = Boolean(getApp(ABOUT_APP_ID));
  const hasHome = Boolean(getApp(DEFAULT_APP_ID));

  const launch = (id: string) => {
    openApp(id);
    close();
  };

  const triggerCls = (active: boolean) =>
    [
      'rounded-[2px] px-2 py-[2px] text-[11px] leading-none',
      'focus-visible:outline focus-visible:outline-1 focus-visible:outline-os-ink',
      active ? 'bg-os-ink text-os-face' : 'hover:bg-os-chrome',
    ].join(' ');

  return (
    <div
      ref={barRef}
      className="fixed inset-x-0 top-0 flex items-center gap-1 border-b border-os-ink bg-os-face px-2 os-chrome-text"
      style={{ height: MENUBAR_HEIGHT, zIndex: LAYERS.menuBar }}
    >
      {/* ── Apps, left ──────────────────────────────────────────────────── */}
      <div className="relative" onKeyDown={(e) => onMenuKeyDown(e, 'apps')}>
        <button
          ref={appsBtn}
          type="button"
          aria-haspopup="menu"
          aria-expanded={openMenu === 'apps'}
          className={triggerCls(openMenu === 'apps')}
          onClick={() => setOpenMenu((m) => (m === 'apps' ? null : 'apps'))}
        >
          Apps
        </button>

        {openMenu === 'apps' && (
          <div
            ref={popRef}
            className="absolute left-0 top-full pt-1"
            style={{ zIndex: LAYERS.menuPopover }}
          >
            <MenuList className="max-h-[70vh] w-[220px] overflow-y-auto os-scroll">
              {grouped.length === 0 && <MenuItem disabled>No apps registered</MenuItem>}

              {grouped.map((group, gi) => (
                <div key={group.key} role="group" aria-label={group.label}>
                  {gi > 0 && <MenuSeparator />}
                  <MenuHeading>{group.label}</MenuHeading>
                  {group.items.map((a) => (
                    <MenuItem
                      key={a.id}
                      onSelect={() => launch(a.id)}
                      hint={running.has(a.id) ? '●' : undefined}
                      icon={
                        <Image src={a.icon} alt="" width={14} height={14} className="pixelated" />
                      }
                    >
                      {a.title}
                    </MenuItem>
                  ))}
                </div>
              ))}

              <MenuSeparator />
              <MenuItem
                disabled={running.size === 0}
                onSelect={() => {
                  closeAll();
                  close();
                }}
              >
                Close All Windows
              </MenuItem>
            </MenuList>
          </div>
        )}
      </div>

      <div className="flex-1" />

      <span className="px-2 text-[10px] leading-none text-os-ink-soft" suppressHydrationWarning>
        {clock}
      </span>

      {/* ── logo, right: About Me + socials ─────────────────────────────── */}
      <div className="relative" onKeyDown={(e) => onMenuKeyDown(e, 'logo')}>
        <button
          ref={logoBtn}
          type="button"
          aria-label={`${bio.name} — about and links`}
          aria-haspopup="menu"
          aria-expanded={openMenu === 'logo'}
          className={[
            'flex items-center rounded-[2px] px-1.5 py-[2px]',
            'focus-visible:outline focus-visible:outline-1 focus-visible:outline-os-ink',
            openMenu === 'logo' ? 'bg-os-ink' : 'hover:bg-os-chrome',
          ].join(' ')}
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
          <div
            ref={popRef}
            className="absolute right-0 top-full pt-1"
            style={{ zIndex: LAYERS.menuPopover }}
          >
            <MenuList className="w-[240px]">
              <MenuHeading>{bio.name}</MenuHeading>

              {hasAbout && (
                <MenuItem onSelect={() => launch(ABOUT_APP_ID)}>About This Macintosh…</MenuItem>
              )}
              {hasHome && <MenuItem onSelect={() => launch(DEFAULT_APP_ID)}>About Me…</MenuItem>}

              <MenuSeparator />
              <MenuHeading>Elsewhere</MenuHeading>
              {bio.socials.length === 0 && <MenuItem disabled>No links yet</MenuItem>}
              {bio.socials.map((s) => (
                <MenuItem key={s.url} href={s.url} hint={s.handle} onSelect={() => close()}>
                  {s.label}
                </MenuItem>
              ))}

              {bio.email && (
                <>
                  <MenuSeparator />
                  <MenuItem href={`mailto:${bio.email}`} onSelect={() => close()}>
                    {bio.email}
                  </MenuItem>
                </>
              )}

              {/* Drops back to the 1984 classic shell, so the desk accessories
                  stay re-explorable instead of being a one-time cutscene. */}
              <MenuSeparator />
              <MenuItem
                onSelect={() => {
                  close();
                  restart();
                }}
              >
                Restart…
              </MenuItem>
            </MenuList>
          </div>
        )}
      </div>
    </div>
  );
}
