/**
 * App manifest — the Downloads folder.
 *
 * A folder is an app here because the OS has no filesystem: there is nothing
 * for a Finder to browse, only a list of sample exports that know which app
 * opens them. lib/os/registry.ts unions the manifests; it is never edited
 * directly.
 */
import dynamic from 'next/dynamic';
import { APP_ICONS } from '@/content/images';
import type { AppDefinition } from '@/lib/os/types';

const DownloadsApp = dynamic(() => import('@/components/apps/downloads/DownloadsApp'), {
  ssr: false,
});

export const apps: AppDefinition[] = [
  {
    id: 'downloads',
    title: 'Downloads',
    icon: APP_ICONS.downloads,
    category: 'system',
    component: DownloadsApp,
    defaultSize: { width: 480, height: 320 },
    minSize: { width: 280, height: 200 },
    showOnDesktop: true,
    description: 'Sample WhatsApp chat exports. Open one to load it into the simulator.',
  },
];
