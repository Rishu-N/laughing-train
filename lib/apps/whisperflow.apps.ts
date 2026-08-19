/**
 * App manifest — WhisperFlow.
 *
 * lib/os/registry.ts unions the manifests automatically; the registry itself is
 * never edited, which is what lets an app be added without touching a file
 * anyone else owns.
 */
import dynamic from 'next/dynamic';
import { APP_ICONS } from '@/content/images';
import type { AppDefinition } from '@/lib/os/types';

// ssr: false is required — this one touches getUserMedia, MediaRecorder,
// AudioContext and localStorage, none of which exist during SSR.
const WhisperFlowApp = dynamic(
  () => import('@/components/apps/whisperflow/WhisperFlowApp'),
  { ssr: false },
);

export const apps: AppDefinition[] = [
  {
    id: 'whisperflow',
    title: 'WhisperFlow',
    icon: APP_ICONS.whisperflow,
    category: 'creative',
    component: WhisperFlowApp,
    defaultSize: { width: 560, height: 480 },
    minSize: { width: 320, height: 340 },
    showOnDesktop: true,
    description: 'Dictation. Speak, and the words land in Notes.',
  },
];
