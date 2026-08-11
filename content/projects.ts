/**
 * content/projects.ts — the ONLY place project data lives.
 *
 * This file drives `lib/apps/projects.apps.ts`, which maps over the array below
 * and generates one AppDefinition per entry (one component, N apps). To add a
 * real project later, add ONE array entry here — no new component, no new file,
 * no registry edit required.
 *
 * These four entries are deliberately thin, obviously-templated placeholders.
 * They exist so the layout, chips and links render correctly while the owner's
 * real projects are written up. Every field is filled in so nothing looks
 * broken, but the copy is intentionally generic — this data gets replaced
 * wholesale, not edited in place.
 *
 * Schema: see `Project` in content/types.ts (frozen — read it before editing).
 */
import { projectScreenshot } from '@/content/images';
import type { Project } from '@/content/types';

export const projects: Project[] = [
  {
    // id: kebab-case, unique. Becomes the app id AND the terminal `open <id>`
    // command (e.g. `open cli-tool`), so keep it short and typeable.
    id: 'cli-tool',
    // title: shown in the window title bar and the dock tooltip.
    title: 'Placeholder CLI Tool',
    // blurb: one sentence, shown in the window header and terminal `ls`.
    blurb: 'A command-line utility that does a small, useful thing well.',
    // description: body copy, one paragraph per array entry.
    description: [
      'This is placeholder copy standing in for a real Python CLI project — '
        + 'the kind of small, sharp tool that automates one annoying task.',
      'Replace this paragraph (and this whole entry) with an actual writeup: '
        + 'what problem it solved, how it works, what was tricky about it.',
    ],
    // language: drives the icon colour via iconForLanguage().
    language: 'Python',
    // tech: stack/tooling chips.
    tech: ['Python', 'Click', 'PyPI'],
    // links: any number, including zero.
    links: [
      { label: 'GitHub', url: 'https://github.com/example/placeholder-cli' },
    ],
    // screenshot: always sourced from content/images.ts helpers.
    screenshot: projectScreenshot(1),
    // year: shown in the header, e.g. "2024" or "2023–24".
    year: '2024',
    // status: optional short chip.
    status: 'placeholder',
  },
  {
    id: 'data-pipeline',
    title: 'Placeholder Data Pipeline',
    blurb: 'A pandas-based pipeline that cleans and reshapes a messy dataset.',
    description: [
      'Stand-in copy for a data-wrangling project: ingesting a raw dataset, '
        + 'cleaning it up with pandas, and producing something analysable.',
      'Swap this out for the real thing — the dataset, the transforms that '
        + 'mattered, and what the output was used for.',
    ],
    language: 'Python',
    tech: ['Python', 'pandas', 'Jupyter'],
    links: [
      { label: 'GitHub', url: 'https://github.com/example/placeholder-pipeline' },
      { label: 'Writeup', url: 'https://example.com/placeholder-writeup' },
    ],
    screenshot: projectScreenshot(2),
    year: '2023',
    status: 'placeholder',
  },
  {
    id: 'scraper-bot',
    title: 'Placeholder Scraper',
    blurb: 'A small scraper/ML toy that pulls data and does something with it.',
    description: [
      'Placeholder for a scraper-or-small-ML project — think: fetch pages or '
        + 'an API on a schedule, then classify or summarise what comes back.',
      'Real version should name the source, the approach, and the result.',
    ],
    language: 'Python',
    tech: ['Python', 'requests', 'BeautifulSoup', 'scikit-learn'],
    links: [
      { label: 'GitHub', url: 'https://github.com/example/placeholder-scraper' },
    ],
    screenshot: projectScreenshot(3),
    year: '2022–23',
    status: 'archived',
  },
  {
    id: 'ui-playground',
    title: 'Placeholder UI Playground',
    blurb: 'A small frontend experiment for trying out an interface idea.',
    description: [
      'Placeholder for a frontend/UI project — a small interactive page or '
        + 'component built to try out a layout or interaction idea.',
      'Replace with the real project: what it does, what it looks like, and '
        + 'what was interesting about building it.',
    ],
    language: 'TypeScript',
    tech: ['TypeScript', 'React', 'CSS'],
    links: [
      { label: 'GitHub', url: 'https://github.com/example/placeholder-ui' },
      { label: 'Live demo', url: 'https://example.com/placeholder-demo' },
    ],
    screenshot: projectScreenshot(4),
    year: '2024',
    status: 'in progress',
  },
];
