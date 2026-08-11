/**
 * ── YOUR BIO ─────────────────────────────────────────────────────────────────
 * This is the first file to edit. Everything here is placeholder text.
 * Rendered by: the Browser app (the window open on boot) and the menu-bar
 * dropdown in the top right.
 *
 * OWNER: Content & Identity agent (Phase 1). Replaced with real copy by you.
 */
import type { Bio } from './types';

export const bio: Bio = {
  name: 'Your Name',
  tagline: 'Placeholder tagline — replace me in content/bio.ts',
  location: 'Somewhere, Earth',
  status: 'Placeholder status line',
  about: [
    'Placeholder paragraph. Replace this in content/bio.ts.',
  ],
  skills: ['Python'],
  socials: [{ label: 'GitHub', url: 'https://github.com/', handle: '@you' }],
  email: 'you@example.com',
  nowPlaying: [],
};

export default bio;
