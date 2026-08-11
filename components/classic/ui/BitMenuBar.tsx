'use client';

/**
 * The 1984 menu bar and its pull-down menus.
 *
 * OWNER: Classic Boot agent.
 *
 * Thinner than System 7's, no drop shadow on the menus, and a selected row is
 * a straight video invert rather than a highlight colour. Keyboard support is
 * the standard menubar pattern: Left/Right walk the titles, Down opens, Up/Down
 * walk the rows, Escape closes and puts focus back on the title.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import type { PixelMap } from '@/components/classic/icons';
import { BIT_FONT, Dithered } from '@/components/classic/ui/Bit';
import PixelIcon from '@/components/classic/ui/PixelIcon';
import { CLASSIC_LAYERS, CLASSIC_MENUBAR_HEIGHT } from '@/lib/classic/metrics';

export interface BitMenuRow {
  id: string;
  label?: string;
  /** Renders as a hairline; never focusable. */
  separator?: boolean;
  disabled?: boolean;
  /** Shows the classic check mark in the left gutter. */
  checked?: boolean;
  icon?: PixelMap;
  onSelect?: () => void;
}

export interface BitMenuDef {
  id: string;
  /** Text title. Omit when the title is a mark. */
  label?: string;
  /** Bitmap title — the brand mark at the far left. */
  mark?: ReactNode;
  /** Required when the title is a mark rather than text. */
  ariaLabel?: string;
  rows: BitMenuRow[];
}

export interface BitMenuBarProps {
  menus: BitMenuDef[];
  /** Right-hand side of the bar — the blinking update flag lives here. */
  right?: ReactNode;
  /** Fires whenever a menu is pulled down (the mascot listens for this). */
  onMenuOpen?: (id: string) => void;
}

function isFocusable(row: BitMenuRow): boolean {
  return !row.separator && !row.disabled;
}

export default function BitMenuBar({ menus, right, onMenuOpen }: BitMenuBarProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [focusRow, setFocusRow] = useState<number>(-1);

  const titleRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const barRef = useRef<HTMLDivElement>(null);

  const openIndex = menus.findIndex((m) => m.id === openId);
  const openMenu = openIndex >= 0 ? menus[openIndex] : null;

  const close = useCallback((restoreFocus = false) => {
    setOpenId((current) => {
      if (restoreFocus && current) titleRefs.current[current]?.focus();
      return null;
    });
    setFocusRow(-1);
  }, []);

  const open = useCallback(
    (id: string, row = -1) => {
      setOpenId(id);
      setFocusRow(row);
      onMenuOpen?.(id);
    },
    [onMenuOpen],
  );

  // Click anywhere else puts the menu away, exactly like letting go of the
  // mouse outside a pull-down did.
  useEffect(() => {
    if (!openId) return;
    const onDown = (e: globalThis.PointerEvent) => {
      if (barRef.current?.contains(e.target as Node)) return;
      close();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [openId, close]);

  // Roving focus inside the open menu.
  useEffect(() => {
    if (openId && focusRow >= 0) rowRefs.current[focusRow]?.focus();
  }, [openId, focusRow]);

  const step = (from: number, delta: number): number => {
    if (!openMenu) return -1;
    const n = openMenu.rows.length;
    for (let i = 1; i <= n; i += 1) {
      const next = (from + delta * i + n * n) % n;
      if (isFocusable(openMenu.rows[next])) return next;
    }
    return from;
  };

  const firstFocusable = (menu: BitMenuDef): number =>
    menu.rows.findIndex(isFocusable);

  const onTitleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const menu = menus[index];
    switch (e.key) {
      case 'ArrowDown':
      case 'Enter':
      case ' ':
        e.preventDefault();
        open(menu.id, firstFocusable(menu));
        break;
      case 'ArrowRight':
      case 'ArrowLeft': {
        e.preventDefault();
        const delta = e.key === 'ArrowRight' ? 1 : -1;
        const next = menus[(index + delta + menus.length) % menus.length];
        titleRefs.current[next.id]?.focus();
        if (openId) open(next.id, firstFocusable(next));
        break;
      }
      case 'Escape':
        if (openId) {
          e.preventDefault();
          close();
        }
        break;
      default:
        break;
    }
  };

  const onRowKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!openMenu) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusRow(step(index, 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusRow(step(index, -1));
        break;
      case 'Home':
        e.preventDefault();
        setFocusRow(step(-1, 1));
        break;
      case 'End':
        e.preventDefault();
        setFocusRow(step(0, -1));
        break;
      case 'ArrowRight':
      case 'ArrowLeft': {
        e.preventDefault();
        const delta = e.key === 'ArrowRight' ? 1 : -1;
        const next = menus[(openIndex + delta + menus.length) % menus.length];
        open(next.id, firstFocusable(next));
        break;
      }
      case 'Escape':
        e.preventDefault();
        close(true);
        break;
      default:
        break;
    }
  };

  return (
    <div
      ref={barRef}
      className={`${BIT_FONT} absolute inset-x-0 top-0 flex items-stretch border-b border-black bg-white text-black`}
      style={{ height: CLASSIC_MENUBAR_HEIGHT, zIndex: CLASSIC_LAYERS.menuBar }}
    >
      <div role="menubar" aria-label="Main menu" className="flex items-stretch">
        {menus.map((menu, i) => {
          const expanded = openId === menu.id;
          return (
            <div key={menu.id} className="relative flex items-stretch">
              <button
                type="button"
                role="menuitem"
                aria-haspopup="true"
                aria-expanded={expanded}
                aria-label={menu.ariaLabel}
                ref={(el) => {
                  titleRefs.current[menu.id] = el;
                }}
                onClick={() =>
                  expanded ? close() : open(menu.id, -1)
                }
                onPointerEnter={() => {
                  if (openId && openId !== menu.id) open(menu.id, -1);
                }}
                onKeyDown={(e) => onTitleKeyDown(e, i)}
                className={[
                  'flex cursor-default items-center px-[9px] text-[10px] leading-none select-none',
                  'focus-visible:shadow-[inset_0_0_0_2px_#000] focus-visible:outline-none',
                  expanded ? 'bg-black text-white' : 'bg-white text-black',
                ].join(' ')}
              >
                {menu.mark ?? menu.label}
              </button>

              {expanded && (
                <MenuPanel
                  menu={menu}
                  focusRow={focusRow}
                  rowRefs={rowRefs}
                  onRowKeyDown={onRowKeyDown}
                  onSelect={(row) => {
                    close();
                    row.onSelect?.();
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {right && <div className="ml-auto flex items-stretch">{right}</div>}
    </div>
  );
}

function MenuPanel({
  menu,
  focusRow,
  rowRefs,
  onRowKeyDown,
  onSelect,
}: {
  menu: BitMenuDef;
  focusRow: number;
  rowRefs: RefObject<(HTMLButtonElement | null)[]>;
  onRowKeyDown: (e: KeyboardEvent<HTMLButtonElement>, index: number) => void;
  onSelect: (row: BitMenuRow) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);

  // At 375px a pull-down near the right edge would run off screen; nudge it
  // back rather than letting the body scroll sideways.
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const overflow = rect.right - (window.innerWidth - 4);
    setShift(overflow > 0 ? -overflow : 0);
  }, []);

  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label={menu.ariaLabel ?? menu.label}
      className="absolute left-0 top-full min-w-[168px] border border-black bg-white py-[2px]"
      style={{ zIndex: CLASSIC_LAYERS.menuPopover, marginLeft: shift }}
    >
      {menu.rows.map((row, index) =>
        row.separator ? (
          <div
            key={row.id}
            role="separator"
            aria-orientation="horizontal"
            className="my-[3px] h-px bg-black"
          />
        ) : (
          <button
            key={row.id}
            type="button"
            role="menuitem"
            aria-disabled={row.disabled || undefined}
            tabIndex={focusRow === index ? 0 : -1}
            ref={(el) => {
              rowRefs.current[index] = el;
            }}
            onClick={() => {
              if (row.disabled) return;
              onSelect(row);
            }}
            onKeyDown={(e) => onRowKeyDown(e, index)}
            className={[
              'flex w-full cursor-default items-center gap-2 whitespace-nowrap px-2 py-[3px]',
              'text-left text-[10px] leading-none select-none',
              row.disabled
                ? 'bg-white text-black'
                : 'bg-white text-black hover:bg-black hover:text-white focus:bg-black focus:text-white focus:outline-none',
            ].join(' ')}
          >
            <span aria-hidden="true" className="w-[8px] shrink-0 text-center">
              {row.checked ? '✓' : ''}
            </span>
            {row.icon && <PixelIcon map={row.icon} size={16} />}
            <span className="flex-1">
              {row.disabled ? <Dithered>{row.label}</Dithered> : row.label}
            </span>
          </button>
        ),
      )}
    </div>
  );
}
