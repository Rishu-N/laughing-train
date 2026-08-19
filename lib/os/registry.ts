/**
 * The app registry — the union of every agent's manifest.
 *
 * COORDINATOR-OWNED. Phase 1 agents must NOT edit this file. Add your apps to
 * your own manifest in lib/apps/<yours>.apps.ts and they appear here for free.
 *
 * This indirection is deliberate: seven agents working in one tree would collide
 * constantly on a single registry file, so each owns a manifest instead.
 */
import { apps as systemApps } from '@/lib/apps/system.apps';
import { apps as contentApps } from '@/lib/apps/content.apps';
import { apps as creativeApps } from '@/lib/apps/creative.apps';
import { apps as terminalApps } from '@/lib/apps/terminal.apps';
import { apps as projectApps } from '@/lib/apps/projects.apps';
import { apps as gameApps } from '@/lib/apps/games.apps';
import { apps as factsweeperApps } from '@/lib/apps/factsweeper.apps';
import { apps as whatsappApps } from '@/lib/apps/whatsapp.apps';
import { apps as downloadsApps } from '@/lib/apps/downloads.apps';
import { apps as whisperflowApps } from '@/lib/apps/whisperflow.apps';
import type { AppCategory, AppDefinition } from './types';

/** The app opened automatically on boot. */
export const DEFAULT_APP_ID = 'browser';

const ALL: AppDefinition[] = [
  ...systemApps,
  ...contentApps,
  ...creativeApps,
  ...terminalApps,
  ...projectApps,
  ...gameApps,
  ...factsweeperApps,
  ...whatsappApps,
  ...downloadsApps,
  ...whisperflowApps,
];

// Duplicate ids would make `open <app>` ambiguous and break dock identity. Fail
// loudly in dev rather than shipping a registry where one app shadows another.
if (process.env.NODE_ENV !== 'production') {
  const seen = new Set<string>();
  for (const app of ALL) {
    if (seen.has(app.id)) {
      console.error(
        `[registry] Duplicate app id "${app.id}". Every AppDefinition.id must be unique across all manifests.`,
      );
    }
    seen.add(app.id);
  }
}

const BY_ID = new Map(ALL.map((a) => [a.id, a]));

/** Every registered app, in manifest order. */
export function allApps(): AppDefinition[] {
  return ALL;
}

/** Look up one app by id. Returns undefined for unknown ids. */
export function getApp(id: string): AppDefinition | undefined {
  return BY_ID.get(id);
}

/** Apps in one category, e.g. for the Apps menu or a Games submenu. */
export function appsByCategory(category: AppCategory): AppDefinition[] {
  return ALL.filter((a) => a.category === category);
}

/** Apps that render an icon on the desktop surface. */
export function desktopApps(): AppDefinition[] {
  return ALL.filter((a) => a.showOnDesktop);
}

/** Sorted ids — used by the terminal for `ls` output and tab completion. */
export function appIds(): string[] {
  return ALL.map((a) => a.id).sort();
}
