/**
 * App manifest — OWNED BY ONE AGENT ONLY.
 *
 * Export your AppDefinitions from here. lib/os/registry.ts picks them up
 * automatically; you never edit the registry itself.
 */
import dynamic from 'next/dynamic';
import { APP_ICONS } from '@/content/images';
import type { AppDefinition } from '@/lib/os/types';

// ssr: false is REQUIRED — the game reads localStorage on mount and measures
// its own layout with a ResizeObserver.
const FactSweeperApp = dynamic(
  () => import('@/components/apps/games/factsweeper/FactSweeperApp'),
  { ssr: false },
);

export const apps: AppDefinition[] = [
  {
    id: 'factsweeper',
    title: 'Fact-sweeper',
    icon: APP_ICONS.factsweeper,
    category: 'game',
    component: FactSweeperApp,
    // Fits the 16x16 board plus the docked dossier rail without scrolling.
    defaultSize: { width: 648, height: 566 },
    // Narrow enough for a phone; the board scrolls inside its own well below this.
    minSize: { width: 336, height: 340 },
    showOnDesktop: true,
    description:
      'Minesweeper on a corrupted disk. Every safe sector recovers a fact about me.',
  },
];
