/**
 * App manifest — OWNED BY ONE AGENT ONLY.
 *
 * Export your AppDefinitions from here. lib/os/registry.ts picks them up
 * automatically; you never edit the registry itself.
 *
 * This manifest generates ONE AppDefinition per entry in content/projects.ts,
 * all pointing at the same ProjectApp component. Adding a project later is a
 * single array entry in content/projects.ts — nothing here needs to change.
 */
import dynamic from 'next/dynamic';
import { iconForLanguage } from '@/content/images';
import { projects } from '@/content/projects';
import type { AppDefinition } from '@/lib/os/types';

// ssr: false is REQUIRED — apps touch canvas, localStorage and window.
const ProjectApp = dynamic(() => import('@/components/apps/project/ProjectApp'), {
  ssr: false,
});

export const apps: AppDefinition[] = projects.map(
  (p): AppDefinition => ({
    id: p.id,
    title: p.title,
    icon: iconForLanguage(p.language),
    category: 'project',
    component: ProjectApp,
    params: { projectId: p.id },
    description: p.blurb,
    defaultSize: { width: 520, height: 480 },
    minSize: { width: 320, height: 360 },
    // Project apps are opened from a Projects list / terminal `open <id>`,
    // not scattered across the desktop — see CONTRACT.md §4.
    showOnDesktop: false,
  }),
);
