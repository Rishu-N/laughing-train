/**
 * App manifest — Content & Identity agent.
 *
 * lib/os/registry.ts picks these up automatically; the registry itself is never
 * edited by hand.
 *
 * NOTE: the `browser` id is load-bearing. registry.ts exports
 * DEFAULT_APP_ID = 'browser' and the OS opens it on boot, so this is the window
 * a visitor sees first. Renaming the id would boot to an empty desktop.
 */
import dynamic from 'next/dynamic';
import { APP_ICONS } from '@/content/images';
import type { AppDefinition } from '@/lib/os/types';

// ssr: false is required — the browser keeps its history in client state and
// reads prefers-reduced-motion from window on mount.
const BrowserApp = dynamic(() => import('@/components/apps/browser/BrowserApp'), {
  ssr: false,
});

export const apps: AppDefinition[] = [
  {
    id: 'browser',
    title: 'Browser',
    icon: APP_ICONS.browser,
    category: 'system',
    component: BrowserApp,
    defaultSize: { width: 720, height: 520 },
    minSize: { width: 340, height: 300 },
    showOnDesktop: true,
    description: 'A very small web browser pointed at my home page.',
  },
];
