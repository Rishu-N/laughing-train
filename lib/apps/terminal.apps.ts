/**
 * App manifest — OWNED BY THE TERMINAL AGENT.
 *
 * Export your AppDefinitions from here. lib/os/registry.ts picks them up
 * automatically; you never edit the registry itself.
 */
import dynamic from 'next/dynamic';
import { APP_ICONS } from '@/content/images';
import type { AppDefinition } from '@/lib/os/types';

// ssr: false is required — the terminal touches window, localStorage and fetch.
const TerminalApp = dynamic(() => import('@/components/apps/terminal/TerminalApp'), {
  ssr: false,
});

export const apps: AppDefinition[] = [
  {
    id: 'terminal',
    title: 'Terminal',
    icon: APP_ICONS.terminal,
    category: 'system',
    component: TerminalApp,
    defaultSize: { width: 620, height: 420 },
    minSize: { width: 300, height: 220 },
    showOnDesktop: true,
    description: 'A green-on-black shell. Type help, or just ask it something.',
  },
];
