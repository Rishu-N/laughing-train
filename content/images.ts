/**
 * Every image path in the OS, in one place.
 *
 * COORDINATOR-OWNED for the slot names; the FILES are yours to replace.
 *
 * To swap in a real image: drop your file into the matching folder under
 * /public/images/ using the SAME filename, and it appears everywhere that slot
 * is used. No code change needed. If you'd rather use a different filename,
 * change the string here — that is the only edit required.
 *
 * Every file currently in /public/images is a generated placeholder.
 */

/* --------------------------------------------------------------- system ---- */

export const SYSTEM_IMAGES = {
  /** Menu-bar logo, top right. Click target for the About/socials dropdown. */
  logo: '/images/desktop/logo.svg',
  /** Shown during the boot sequence. */
  happyMac: '/images/desktop/happy-mac.svg',
  /** Tiled behind the whole desktop. */
  desktopPattern: '/images/desktop/pattern.svg',
} as const;

/* ------------------------------------------------------------ app icons ---- */

/**
 * Dock / desktop / menu icons, one per app. Keys match AppDefinition.id.
 */
export const APP_ICONS = {
  browser: '/images/icons/browser.svg',
  paint: '/images/icons/paint.svg',
  notes: '/images/icons/notes.svg',
  word: '/images/icons/word.svg',
  spreadsheet: '/images/icons/spreadsheet.svg',
  terminal: '/images/icons/terminal.svg',
  factsweeper: '/images/icons/factsweeper.svg',
  snake: '/images/icons/snake.svg',
  g2048: '/images/icons/2048.svg',
  about: '/images/icons/about.svg',
  /** Fallback for project apps whose language has no specific icon. */
  project: '/images/icons/project.svg',
  projectPython: '/images/icons/project-python.svg',
  projectWeb: '/images/icons/project-web.svg',
} as const;

export type AppIconKey = keyof typeof APP_ICONS;

/* ---------------------------------------------------------------- me ------- */

/**
 * The pixelated self-portrait preloaded into the Paint app.
 * REPLACE THIS with a real pixel portrait of yourself — same filename, and Paint
 * picks it up automatically.
 */
export const SELF_PORTRAIT = '/images/portrait/self-portrait-placeholder.png';

/* ------------------------------------------------------------ projects ----- */

/**
 * Screenshot slots for project apps. There are six generated placeholders; add
 * more files named project-07-screenshot.png etc. if you outgrow them.
 */
export const PROJECT_SCREENSHOTS = [
  '/images/projects/project-01-screenshot.png',
  '/images/projects/project-02-screenshot.png',
  '/images/projects/project-03-screenshot.png',
  '/images/projects/project-04-screenshot.png',
  '/images/projects/project-05-screenshot.png',
  '/images/projects/project-06-screenshot.png',
] as const;

/** 1-indexed helper: projectScreenshot(1) -> project-01-screenshot.png */
export function projectScreenshot(n: number): string {
  return (
    PROJECT_SCREENSHOTS[n - 1] ?? `/images/projects/project-${String(n).padStart(2, '0')}-screenshot.png`
  );
}

/** Pick a sensible icon for a project from its primary language. */
export function iconForLanguage(language: string): string {
  const l = language.trim().toLowerCase();
  if (l.includes('python')) return APP_ICONS.projectPython;
  if (
    l.includes('typescript') ||
    l.includes('javascript') ||
    l.includes('react') ||
    l.includes('css') ||
    l.includes('html')
  ) {
    return APP_ICONS.projectWeb;
  }
  return APP_ICONS.project;
}
