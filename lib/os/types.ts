/**
 * Core OS contract types.
 *
 * FROZEN in Phase 0 — Phase 1 agents read this file and never modify it.
 * If you need a new field, ask the coordinator.
 */
import type { ComponentType } from 'react';

/** Broad grouping used by the dock, the Apps menu and the terminal `ls` command. */
export type AppCategory = 'system' | 'creative' | 'project' | 'game';

/**
 * Props every app component receives. An app is just a React component rendered
 * inside a window frame — it knows nothing about dragging, z-index or the dock.
 */
export interface AppWindowProps {
  /** Unique per open window. Use it to namespace anything instance-specific. */
  instanceId: string;
  /** The AppDefinition.id this window was opened from. */
  appId: string;
  /** Arbitrary launch params, e.g. { projectId: 'proj-01' } for project apps. */
  params?: Record<string, string>;
  /** Rename this window's title bar (e.g. Notes showing the current note name). */
  setTitle: (title: string) => void;
  /** Close this window from inside the app (e.g. a Quit menu item). */
  close: () => void;
}

/**
 * One entry in the app registry. Every app in the OS — system, creative, project
 * or game — is described by one of these.
 */
export interface AppDefinition {
  /** kebab-case, globally unique. This is what `open <id>` uses in the terminal. */
  id: string;
  /** Shown in the title bar, dock tooltip and Apps menu. */
  title: string;
  /** Path to an icon, always sourced from content/images.ts. */
  icon: string;
  category: AppCategory;
  /**
   * The app component. Wrap in next/dynamic with `ssr: false` — apps touch
   * canvas, localStorage and window, none of which exist during SSR.
   */
  component: ComponentType<AppWindowProps>;
  /** Opening size in CSS pixels. */
  defaultSize: { width: number; height: number };
  /** Floor for user resizing. Defaults to 240x160. */
  minSize?: { width: number; height: number };
  /** Fixed opening position. Omit to let the window manager cascade it. */
  defaultPosition?: { x: number; y: number };
  /** Defaults to true. */
  resizable?: boolean;
  /** Defaults to true: re-opening focuses the existing window instead of duplicating. */
  singleton?: boolean;
  /** Show an icon for this app on the desktop surface. Defaults to false. */
  showOnDesktop?: boolean;
  /** One-line blurb surfaced by the terminal `ls` command and the dock tooltip. */
  description?: string;
  /** Launch params baked into the definition (used by generated project apps). */
  params?: Record<string, string>;
}

/** A single open window. Owned entirely by the window store. */
export interface WindowInstance {
  instanceId: string;
  appId: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
  /** Pre-maximize geometry, restored on un-maximize. */
  restoreRect?: { x: number; y: number; width: number; height: number };
  params?: Record<string, string>;
}

/** Options accepted by openApp(). */
export interface OpenAppOptions {
  params?: Record<string, string>;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}
