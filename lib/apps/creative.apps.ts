/**
 * App manifest — Creative Suite (Paint, Notes, Word, Spreadsheet).
 *
 * lib/os/registry.ts picks these up automatically; the registry is never edited
 * directly.
 */
import dynamic from 'next/dynamic';
import { APP_ICONS } from '@/content/images';
import type { AppDefinition } from '@/lib/os/types';

// ssr: false is required — all four touch canvas, localStorage or document.
const PaintApp = dynamic(() => import('@/components/apps/paint/PaintApp'), { ssr: false });
const NotesApp = dynamic(() => import('@/components/apps/notes/NotesApp'), { ssr: false });
const WordApp = dynamic(() => import('@/components/apps/word/WordApp'), { ssr: false });
const SpreadsheetApp = dynamic(
  () => import('@/components/apps/spreadsheet/SpreadsheetApp'),
  { ssr: false },
);

export const apps: AppDefinition[] = [
  {
    id: 'paint',
    title: 'Paint',
    icon: APP_ICONS.paint,
    category: 'creative',
    component: PaintApp,
    defaultSize: { width: 660, height: 480 },
    minSize: { width: 360, height: 320 },
    showOnDesktop: true,
    description: 'Draw something. MacPaint, roughly.',
  },
  {
    id: 'notes',
    title: 'Notes',
    icon: APP_ICONS.notes,
    category: 'creative',
    component: NotesApp,
    defaultSize: { width: 440, height: 380 },
    minSize: { width: 260, height: 200 },
    description: 'A plain-text scratchpad that remembers where you left it.',
  },
  {
    id: 'word',
    title: 'Word',
    icon: APP_ICONS.word,
    category: 'creative',
    component: WordApp,
    defaultSize: { width: 720, height: 560 },
    minSize: { width: 340, height: 300 },
    description: 'A word processor with a page, a ruler and delusions of grandeur.',
  },
  {
    id: 'spreadsheet',
    title: 'Spreadsheet',
    icon: APP_ICONS.spreadsheet,
    category: 'creative',
    component: SpreadsheetApp,
    defaultSize: { width: 720, height: 480 },
    minSize: { width: 320, height: 240 },
    description: '26 columns, 50 rows and formulas that actually evaluate.',
  },
];
