'use client';

/**
 * Horizontal chrome strips: app toolbars, tool palettes, status bars.
 *
 * SHARED PRIMITIVE — read-only for Phase 1 agents.
 */
import type { ReactNode } from 'react';

export function Toolbar({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex shrink-0 items-center gap-1 border-b border-os-ink bg-os-chrome px-1.5 py-1 os-chrome-text ${className}`}
    >
      {children}
    </div>
  );
}

/** Vertical hairline between logical groups of toolbar controls. */
export function ToolbarSeparator() {
  return <div aria-hidden className="mx-1 h-[18px] w-px shrink-0 bg-os-chrome-dark" />;
}

/** Pushes everything after it to the right edge of the toolbar. */
export function ToolbarSpacer() {
  return <div className="flex-1" />;
}

/** Small caps label used inside toolbars and palettes. */
export function ToolbarLabel({ children }: { children: ReactNode }) {
  return <span className="px-1 text-[10px] text-os-ink-soft">{children}</span>;
}

/** Bottom-of-window status strip, e.g. the Browser's fake load state. */
export function StatusBar({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex h-[20px] shrink-0 items-center gap-2 border-t border-os-ink bg-os-chrome px-2 text-[10px] os-chrome-text ${className}`}
    >
      {children}
    </div>
  );
}
