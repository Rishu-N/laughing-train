/**
 * App manifest — WhatsApp Chat Simulator.
 *
 * lib/os/registry.ts unions the manifests; it is never edited directly.
 */
import dynamic from 'next/dynamic';
import { APP_ICONS } from '@/content/images';
import type { AppDefinition } from '@/lib/os/types';

// ssr: false is required — the app spins up a Web Worker, IndexedDB and canvas
// on mount, none of which exist on the server.
const WhatsAppApp = dynamic(() => import('@/components/apps/whatsapp/WhatsAppApp'), {
  ssr: false,
});

export const apps: AppDefinition[] = [
  {
    id: 'whatsapp',
    title: 'WhatsApp Simulator',
    icon: APP_ICONS.whatsapp,
    category: 'creative',
    component: WhatsAppApp,
    // Wide enough for the chat list beside a conversation without either
    // being squeezed; the sidebar folds away below 620px of window width.
    defaultSize: { width: 860, height: 600 },
    minSize: { width: 320, height: 320 },
    description: 'Import a WhatsApp chat export, replay it, and save it as PDF, PNG or HTML.',
  },
];
