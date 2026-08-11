'use client';

/**
 * Drop-down menu surface — used by the menu bar and any in-app menus.
 *
 * SHARED PRIMITIVE — read-only for Phase 1 agents.
 */
import type { ReactNode } from 'react';

export function MenuList({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="menu"
      className={`os-window min-w-[180px] rounded-[2px] py-1 os-chrome-text ${className}`}
    >
      {children}
    </div>
  );
}

export interface MenuItemProps {
  children: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  /** Right-aligned hint, e.g. a keyboard shortcut or a handle. */
  hint?: ReactNode;
  /** Leading glyph or icon. */
  icon?: ReactNode;
  /** Renders as an external link — gets target=_blank and rel=noreferrer. */
  href?: string;
}

export function MenuItem({
  children,
  onSelect,
  disabled = false,
  hint,
  icon,
  href,
}: MenuItemProps) {
  const inner = (
    <>
      {icon && <span className="w-4 shrink-0 text-center leading-none">{icon}</span>}
      <span className="flex-1 truncate text-left">{children}</span>
      {hint && <span className="shrink-0 pl-3 text-[10px] opacity-60">{hint}</span>}
    </>
  );

  const cls = [
    'flex w-full items-center gap-2 px-3 py-[3px] text-left text-[11px]',
    disabled
      ? 'text-os-disabled'
      : 'hover:bg-os-accent hover:text-white focus:bg-os-accent focus:text-white',
    'outline-none',
  ].join(' ');

  if (href && !disabled) {
    return (
      <a
        role="menuitem"
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className={cls}
        onClick={onSelect}
      >
        {inner}
      </a>
    );
  }

  return (
    <button role="menuitem" type="button" disabled={disabled} className={cls} onClick={onSelect}>
      {inner}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-os-chrome-dark" />;
}

/** Non-interactive heading inside a menu, e.g. "Socials". */
export function MenuHeading({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 pt-1 pb-0.5 text-[9px] uppercase tracking-wide text-os-ink-soft">
      {children}
    </div>
  );
}
