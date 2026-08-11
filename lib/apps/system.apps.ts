/**
 * App manifest — OS Shell agent.
 *
 * Export your AppDefinitions from here. lib/os/registry.ts picks them up
 * automatically; you never edit the registry itself.
 */
import dynamic from 'next/dynamic';
import { APP_ICONS } from '@/content/images';
import type { AppDefinition } from '@/lib/os/types';

// ssr: false is required — the about box reads live window-manager state.
const AboutBox = dynamic(() => import('@/components/os/AboutBox'), { ssr: false });

export const apps: AppDefinition[] = [
  {
    id: 'about',
    title: 'About This Macintosh',
    icon: APP_ICONS.about,
    category: 'system',
    component: AboutBox,
    defaultSize: { width: 400, height: 300 },
    minSize: { width: 320, height: 240 },
    resizable: true,
    singleton: true,
    showOnDesktop: false,
    description: 'System version, memory map and who built this thing.',
  },
];
