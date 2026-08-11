/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  YOUR BIO — start here.                                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * This is the first file you should edit, and for a lot of people it is the
 * only one they ever need to touch. Everything below is placeholder text: it is
 * written to be obviously fake but the right *shape* and *length*, so the
 * layout looks correct before you have written a single real word. Replace it
 * paragraph by paragraph and the site fills in around you.
 *
 * WHERE THIS SHOWS UP
 *   • The Browser window — the one that opens by itself when the OS boots.
 *     Home / About / Skills / Links / Contact are all rendered from this file.
 *   • The menu-bar dropdown in the top-right corner (name + socials).
 *   • The Terminal, which is given this bio as context when it answers
 *     questions about you.
 *
 * RULES OF THE ROAD
 *   • Only the values change. Do not rename or remove keys — the shape is
 *     enforced by the `Bio` type in content/types.ts, which is frozen.
 *   • Optional fields (marked below) can be deleted entirely or left out; the
 *     Browser hides the corresponding section rather than showing an empty box.
 *   • Keep it short. This is rendered in a fake 1996 browser window that can be
 *     375px wide on a phone, not a Medium post.
 *   • If TypeScript complains after an edit, you have probably lost a comma or
 *     a quote. Run `npx tsc --noEmit` to see exactly where.
 */
import type { Bio } from './types';

export const bio: Bio = {
  /**
   * name — REQUIRED
   * Shown as the big serif headline on the Browser homepage, in the menu-bar
   * dropdown, and in the browser's page titles. Just your name, no title.
   */
  name: 'Your Name Here',

  /**
   * tagline — REQUIRED
   * The one italic line directly under your name. This is the single most
   * read sentence on the whole site, so make it specific rather than grand.
   * Aim for 4–10 words. Think "what I actually do", not a mission statement.
   */
  tagline: 'Placeholder tagline — say what you actually build, in one line',

  /**
   * location — OPTIONAL (delete this line if you would rather not say)
   * Shown on the homepage info panel and again on the Contact page.
   */
  location: 'Your City, Your Country',

  /**
   * status — OPTIONAL
   * A "currently…" line: what you are studying, where you work, what you are
   * building this month. Shown on the homepage under your name. This is the
   * field that goes stale fastest, so keep it easy to rewrite.
   */
  status: 'Placeholder status — e.g. "CS undergrad · writing too much Python"',

  /**
   * about — REQUIRED
   * The About page. One string per paragraph; add or remove array entries
   * freely. Two to four paragraphs is the sweet spot — the browser viewport is
   * small and 90s web pages were not known for their long-form essays.
   *
   * A structure that works: (1) what you do and what you reach for, (2) what
   * you are working on now, (3) the human sentence — what you do when you are
   * not at a keyboard.
   */
  about: [
    'Placeholder paragraph one — replace this in content/bio.ts. This is where you say who you are and what you build. The real version of this paragraph should mention the kind of problems you like, the tools you reach for first, and roughly what stage you are at: student, self-taught, five years in, whatever is true.',

    'Placeholder paragraph two — replace this too. Most of my projects are Python: scripts that grew into tools, data things, small services. Some of them grew a front end because a command line was not enough, which is how I ended up caring about interfaces at all. Say your own version of that story here.',

    'Placeholder paragraph three — optional, delete the whole line if two paragraphs is enough. This one is for the human part: what you read, what you tinker with, what you would talk about for an hour if someone asked. Everything above the fold is a résumé; this bit is the reason someone emails you.',
  ],

  /**
   * skills — REQUIRED
   * Rendered as a two-column bulleted list on the Skills page (one column on a
   * phone). Short entries only — these are chips, not sentences. Anything past
   * about 30 characters will wrap and look untidy.
   *
   * Order matters: put the things you actually want to be hired for first.
   * Delete the ones that are not true — an honest short list beats a long one.
   */
  skills: [
    'Python',
    'TypeScript',
    'React',
    'FastAPI',
    'pandas / NumPy',
    'PostgreSQL',
    'SQLite',
    'Docker',
    'Git',
    'Linux / shell',
    'REST APIs',
    'HTML & CSS',
    'Testing (pytest)',
    'Data wrangling',
    'CLI tooling',
    'A little design',
  ],

  /**
   * socials — REQUIRED (an empty array [] is allowed if you want none)
   * Rendered on the Links page as real, clickable, opens-in-a-new-tab links,
   * and again in the menu-bar dropdown.
   *
   *   label  — what the link is called, e.g. "GitHub"
   *   url    — the FULL url including https://, or the link will not work
   *   handle — OPTIONAL, shown in grey next to the label, e.g. "@you"
   *
   * Add or remove entries freely. Two good links beat six dead ones.
   */
  socials: [
    { label: 'GitHub', url: 'https://github.com/', handle: '@your-handle' },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/', handle: '/in/your-handle' },
    { label: 'Bluesky', url: 'https://bsky.app/', handle: '@you.example.com' },
    { label: 'Blog', url: 'https://example.com/', handle: 'example.com' },
  ],

  /**
   * email — OPTIONAL (delete the line to hide the Contact page's mail link)
   * Shown on the Contact page as a real mailto: link.
   */
  email: 'you@example.com',

  /**
   * nowPlaying — OPTIONAL (delete the whole field to hide the panel)
   * The little boxed sidebar on the Browser homepage — the 90s personal-site
   * "what I'm into right now" list. Keep each line to a few words. Four to six
   * entries fills the box nicely; more than that and it scrolls.
   *
   * This is the field people remember, so make these real. Books, albums,
   * languages you are learning, a game you are losing at.
   */
  nowPlaying: [
    'Reading — a book you are actually reading',
    'Listening — an album on repeat',
    'Learning — a language or tool',
    'Playing — something you are bad at',
    'Building — the current side project',
  ],
};

export default bio;
