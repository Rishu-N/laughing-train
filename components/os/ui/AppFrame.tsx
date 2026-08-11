'use client';

/**
 * Standard interior layout for an app window: optional toolbar, scrolling body,
 * optional status bar. Using this everywhere is what makes seven separately
 * built apps feel like one suite.
 *
 * SHARED PRIMITIVE — read-only for Phase 1 agents.
 *
 *   <AppFrame toolbar={<Toolbar>…</Toolbar>} status={<StatusBar>…</StatusBar>}>
 *     …content…
 *   </AppFrame>
 *
 * AppFrame is `relative`, so <Dialog> raised inside it dims only this app.
 * Pass `scroll={false}` for apps that manage their own scrolling (canvas, games).
 */
import type { ReactNode } from 'react';

export interface AppFrameProps {
  children: ReactNode;
  toolbar?: ReactNode;
  status?: ReactNode;
  /** Left rail, e.g. the Paint tool palette or the Fact-sweeper dossier. */
  sidebar?: ReactNode;
  /** Put the sidebar on the right instead of the left. */
  sidebarSide?: 'left' | 'right';
  scroll?: boolean;
  /** Background for the body area. Defaults to the window face colour. */
  className?: string;
}

export function AppFrame({
  children,
  toolbar,
  status,
  sidebar,
  sidebarSide = 'left',
  scroll = true,
  className = '',
}: AppFrameProps) {
  const body = (
    <div
      className={[
        'min-h-0 min-w-0 flex-1',
        scroll ? 'os-scroll overflow-auto' : 'overflow-hidden',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );

  return (
    <div className="relative flex h-full w-full flex-col bg-os-face">
      {toolbar}
      <div className="flex min-h-0 flex-1">
        {sidebar && sidebarSide === 'left' && sidebar}
        {body}
        {sidebar && sidebarSide === 'right' && sidebar}
      </div>
      {status}
    </div>
  );
}

/** Vertical chrome rail for tool palettes and side panels. */
export function AppSidebar({
  children,
  side = 'left',
  width = 88,
  className = '',
}: {
  children: ReactNode;
  side?: 'left' | 'right';
  width?: number;
  className?: string;
}) {
  return (
    <div
      style={{ width }}
      className={[
        'os-scroll shrink-0 overflow-auto bg-os-chrome p-1.5',
        side === 'left' ? 'border-r' : 'border-l',
        'border-os-ink',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
