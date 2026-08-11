/**
 * App manifest — OWNED BY ONE AGENT ONLY.
 *
 * Export your AppDefinitions from here. lib/os/registry.ts picks them up
 * automatically; you never edit the registry itself.
 */
import dynamic from 'next/dynamic';
import { APP_ICONS } from '@/content/images';
import type { AppDefinition, AppWindowProps } from '@/lib/os/types';

// ssr: false is REQUIRED — these apps touch canvas, localStorage and window.
// The explicit <AppWindowProps> generic is what makes these assignable to
// AppDefinition['component']: neither game reads its props, so without it
// next/dynamic infers ComponentType<{}>.
const SnakeApp = dynamic<AppWindowProps>(() => import('@/components/apps/games/snake/SnakeApp'), {
  ssr: false,
});
const G2048App = dynamic<AppWindowProps>(() => import('@/components/apps/games/g2048/G2048App'), {
  ssr: false,
});

export const apps: AppDefinition[] = [
  {
    id: 'snake',
    title: 'Snake',
    icon: APP_ICONS.snake,
    category: 'game',
    component: SnakeApp,
    defaultSize: { width: 420, height: 520 },
    minSize: { width: 300, height: 400 },
    showOnDesktop: true,
    description: 'Grow the snake without eating your own tail. Arrows or WASD.',
  },
  {
    id: 'g2048',
    title: '2048',
    icon: APP_ICONS.g2048,
    category: 'game',
    component: G2048App,
    defaultSize: { width: 420, height: 540 },
    minSize: { width: 300, height: 420 },
    showOnDesktop: true,
    description: 'Slide and merge tiles to reach 2048. Arrows or swipe.',
  },
];
