'use client';

/**
 * The 1984 monochrome classic shell — the site's front door.
 *
 * OWNER: Classic Boot agent.
 *
 * Every visit lands here, with no skip (CONTRACT-PHASE3.md §2). That is a
 * product decision, and the consequence is that this screen has to be *short*:
 * the startup plate clears in under a second and the Software Update
 * notification drops in from the top-left a couple of seconds later. All of the
 * timing lives in lib/classic/timing.ts.
 *
 * ⚠️ data-testid="classic-shell" is a contract with the e2e suite. So is
 * data-testid="software-update-action", on the Install button inside
 * UpdateNotification.
 *
 * The look is deliberately NOT System 7: pure black and white, dither instead
 * of gray, a thin menu bar, and windows with nothing but a title bar and a
 * close box. Nothing from components/os/ui is imported here — those primitives
 * are beveled and colour-aware, and a bevel is a later idea.
 */
import { motion } from 'framer-motion';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ClassicMark } from '@/components/classic/BrandMarks';
import ClassicDesktop from '@/components/classic/ClassicDesktop';
import { ClassicSystemProvider, type ClassicSystem } from '@/components/classic/ClassicContext';
import { MenuClock, UpdateFlag } from '@/components/classic/MenuBarExtras';
import UpdateNotification from '@/components/classic/UpdateNotification';
import { accessory } from '@/components/classic/accessories';
import {
  ACCESSORY_META,
  DESK_ACCESSORIES,
} from '@/components/classic/accessories/catalog';
import type { AccessoryId } from '@/components/classic/accessories/types';
import { ICON_MACHINE, ICON_UPDATE } from '@/components/classic/icons';
import { BIT_FONT } from '@/components/classic/ui/Bit';
import BitDialog from '@/components/classic/ui/BitDialog';
import BitMenuBar, { type BitMenuDef } from '@/components/classic/ui/BitMenuBar';
import BitWindow from '@/components/classic/ui/BitWindow';
import { usePrefersReducedMotion, useIsNarrow } from '@/lib/classic/media';
import { CLASSIC_LAYERS, CLASSIC_MENUBAR_HEIGHT } from '@/lib/classic/metrics';
import { DEFAULT_PATTERN, patternStyle } from '@/lib/classic/patterns';
import { classicTiming } from '@/lib/classic/timing';
import { useStageStore } from '@/lib/os/stageStore';

interface OpenWindow {
  id: AccessoryId;
  x: number;
  y: number;
  z: number;
}

interface AlertBox {
  title: string;
  message: ReactNode;
}

/** Where the nth window lands when there is room to cascade. */
function cascade(n: number): { x: number; y: number } {
  const step = n % 6;
  return { x: 44 + step * 26, y: CLASSIC_MENUBAR_HEIGHT + 26 + step * 24 };
}

const VIEW_MODES = [
  { id: 'icon', label: 'by Icon' },
  { id: 'name', label: 'by Name' },
  { id: 'date', label: 'by Date' },
  { id: 'size', label: 'by Size' },
];

export default function ClassicShell() {
  const beginUpdate = useStageStore((s) => s.beginUpdate);
  const reducedMotion = usePrefersReducedMotion();
  const narrow = useIsNarrow();
  const timing = classicTiming(reducedMotion);

  const [started, setStarted] = useState(false);
  const [notice, setNotice] = useState<'waiting' | 'shown' | 'later'>('waiting');
  const [pattern, setPattern] = useState(DEFAULT_PATTERN);
  const [menuClock, setMenuClock] = useState(false);
  const [viewMode, setViewMode] = useState('icon');
  const [alertBox, setAlertBox] = useState<AlertBox | null>(null);
  const [windows, setWindows] = useState<OpenWindow[]>([]);

  /** Guards against a second beginUpdate() from a double click. */
  const handedOff = useRef(false);

  /* ------------------------------------------------------------ timing ---- */

  useEffect(() => {
    const plate = window.setTimeout(() => setStarted(true), timing.welcomeMs);
    const drop = window.setTimeout(
      () => setNotice((n) => (n === 'waiting' ? 'shown' : n)),
      timing.noticeMs,
    );
    return () => {
      window.clearTimeout(plate);
      window.clearTimeout(drop);
    };
  }, [timing.welcomeMs, timing.noticeMs]);

  /* ----------------------------------------------------------- windows ---- */

  const open = useCallback((id: AccessoryId) => {
    setWindows((current) => {
      const top = current.reduce(
        (max, w) => Math.max(max, w.z),
        CLASSIC_LAYERS.windowBase - 1,
      );
      // Clicking the front window shouldn't churn state or inflate z.
      const existing = current.find((w) => w.id === id);
      if (existing && existing.z === top) return current;

      // Renormalise rather than climb forever, same idea as the colour OS's
      // window store — there just isn't as far to climb here.
      const base =
        top + 1 > CLASSIC_LAYERS.windowCeiling
          ? current
              .slice()
              .sort((a, b) => a.z - b.z)
              .map((w, i) => ({ ...w, z: CLASSIC_LAYERS.windowBase + i }))
          : current;
      const nextZ =
        base === current ? top + 1 : CLASSIC_LAYERS.windowBase + base.length;

      if (base.some((w) => w.id === id)) {
        return base.map((w) => (w.id === id ? { ...w, z: nextZ } : w));
      }
      return [...base, { id, z: nextZ, ...cascade(base.length) }];
    });
  }, []);

  const close = useCallback((id: AccessoryId) => {
    setWindows((current) => current.filter((w) => w.id !== id));
  }, []);

  const frontId = windows.reduce<OpenWindow | null>(
    (front, w) => (front === null || w.z > front.z ? w : front),
    null,
  )?.id;

  const showAlert = useCallback((title: string, message: ReactNode) => {
    setAlertBox({ title, message });
  }, []);

  const showUpdate = useCallback(() => setNotice('shown'), []);

  const install = useCallback(() => {
    if (handedOff.current) return;
    handedOff.current = true;
    beginUpdate();
  }, [beginUpdate]);

  /* ------------------------------------------------------------- menus ---- */

  const system = useMemo<ClassicSystem>(
    () => ({
      open,
      close,
      alert: showAlert,
      pattern,
      setPattern,
      menuClock,
      setMenuClock,
      showUpdate,
    }),
    [open, close, showAlert, pattern, menuClock, showUpdate],
  );

  const menus = useMemo<BitMenuDef[]>(
    () => [
      {
        id: 'mark',
        ariaLabel: 'System menu',
        mark: <ClassicMark size={14} />,
        rows: [
          {
            id: 'about',
            label: 'About This Machine…',
            icon: ICON_MACHINE,
            onSelect: () => open('about'),
          },
          { id: 'sep-1', separator: true },
          ...DESK_ACCESSORIES.map((id) => ({
            id,
            label: ACCESSORY_META[id].title,
            icon: ACCESSORY_META[id].icon,
            onSelect: () => open(id),
          })),
          { id: 'sep-2', separator: true },
          {
            id: 'software-update',
            label: 'Software Update…',
            icon: ICON_UPDATE,
            onSelect: showUpdate,
          },
        ],
      },
      {
        id: 'file',
        label: 'File',
        rows: [
          { id: 'open', label: 'Open Startup Disk', onSelect: () => open('disk') },
          { id: 'new-folder', label: 'New Folder', disabled: true },
          { id: 'print', label: 'Print', disabled: true },
          { id: 'sep-1', separator: true },
          {
            id: 'close',
            label: 'Close',
            disabled: frontId === undefined,
            onSelect: () => frontId && close(frontId),
          },
          { id: 'sep-2', separator: true },
          { id: 'quit', label: 'Quit', disabled: true },
        ],
      },
      {
        id: 'edit',
        label: 'Edit',
        // Disabled in the Finder in 1984 too. Faithfully useless.
        rows: [
          { id: 'undo', label: 'Undo', disabled: true },
          { id: 'sep-1', separator: true },
          { id: 'cut', label: 'Cut', disabled: true },
          { id: 'copy', label: 'Copy', disabled: true },
          { id: 'paste', label: 'Paste', disabled: true },
          { id: 'clear', label: 'Clear', disabled: true },
        ],
      },
      {
        id: 'view',
        label: 'View',
        rows: VIEW_MODES.map((mode) => ({
          id: mode.id,
          label: mode.label,
          checked: viewMode === mode.id,
          onSelect: () => setViewMode(mode.id),
        })),
      },
      {
        id: 'special',
        label: 'Special',
        rows: [
          {
            id: 'clean-up',
            label: 'Clean Up Desktop',
            onSelect: () =>
              showAlert('Clean Up', 'The desktop is already as tidy as it gets.'),
          },
          {
            id: 'empty-trash',
            label: 'Empty Trash',
            onSelect: () => showAlert('Empty Trash', 'The Trash is already empty.'),
          },
          { id: 'sep-1', separator: true },
          {
            id: 'restart',
            label: 'Restart',
            onSelect: () =>
              showAlert(
                'Restart',
                'This machine restarts into 1984 every time. Install the software update instead.',
              ),
          },
          {
            id: 'shut-down',
            label: 'Shut Down',
            onSelect: () =>
              showAlert(
                'Shut Down',
                'Not while there is a portfolio to look at.',
              ),
          },
        ],
      },
    ],
    [open, close, frontId, showAlert, showUpdate, viewMode],
  );

  /* ------------------------------------------------------------ render ---- */

  return (
    <motion.div
      data-testid="classic-shell"
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.18 }}
      className={`${BIT_FONT} fixed inset-0 overflow-hidden bg-white text-black`}
      // Own stacking context, so nothing in here can reach past the shell.
      style={{ isolation: 'isolate' }}
    >
      <ClassicSystemProvider value={system}>
        {/* Desktop. The pattern is a dither, never a gray. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0"
          style={{ top: CLASSIC_MENUBAR_HEIGHT, ...patternStyle(pattern) }}
        />

        <BitMenuBar
          menus={menus}
          right={
            <>
              {menuClock && <MenuClock />}
              {notice === 'later' && (
                <UpdateFlag onClick={showUpdate} blink={!reducedMotion} />
              )}
            </>
          }
        />

        <ClassicDesktop />

        {windows.map((w) => {
          const def = accessory(w.id);
          const Body = def.Component;
          return (
            <BitWindow
              key={w.id}
              title={def.title}
              x={w.x}
              y={w.y}
              width={def.width}
              height={def.height}
              z={w.z}
              active={w.id === frontId}
              narrow={narrow}
              onClose={() => close(w.id)}
              onFocus={() => open(w.id)}
            >
              <Body onClose={() => close(w.id)} />
            </BitWindow>
          );
        })}

        {notice === 'shown' && (
          <UpdateNotification
            onAccept={install}
            onLater={() => setNotice('later')}
            reducedMotion={reducedMotion}
          />
        )}

        {alertBox && (
          <BitDialog
            title={alertBox.title}
            icon={ICON_MACHINE}
            onClose={() => setAlertBox(null)}
          >
            {alertBox.message}
          </BitDialog>
        )}

        {/* Startup plate. A hard cut, not a fade — 1984 had no compositor. */}
        {!started && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white"
            style={{ zIndex: CLASSIC_LAYERS.welcome }}
          >
            <ClassicMark size={64} />
            <p className="text-[10px] leading-none">Welcome</p>
          </div>
        )}
      </ClassicSystemProvider>
    </motion.div>
  );
}
