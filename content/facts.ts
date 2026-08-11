/**
 * ── FACTS ABOUT YOU ──────────────────────────────────────────────────────────
 *
 * These are what players uncover by clearing cells in Fact-sweeper. Every safe
 * cell recovers one fact, and the Dossier panel fills in as they play. The
 * recovered set is stored in the browser, so a returning visitor keeps whatever
 * they dug up last time.
 *
 * ┌─ HOW TO EDIT ───────────────────────────────────────────────────────────────┐
 * │ Replace every `value` below with something true about you and delete the    │
 * │ ones you don't want. Nothing else in the app needs to change — the game     │
 * │ reads this array and nothing but this array.                                │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * FIELD BY FIELD
 *
 *   id        kebab-case, unique, and PERMANENT. This is the key stored in the
 *             visitor's browser to remember "already recovered". Renaming an id
 *             makes returning visitors lose that fact from their Dossier;
 *             rewriting `label` or `value` is free, so prefer that.
 *
 *   label     the left-hand column in the Dossier. Short — 1–3 words.
 *             Think "First language", not "The first language I ever learned".
 *
 *   value     the right-hand column, and the text of the big "RECOVERED:"
 *             readout after a click. ONE LINE. Roughly 20–60 characters reads
 *             best; much longer and it wraps awkwardly in a narrow window.
 *
 *   category  which Dossier section it files under. Purely organisational —
 *             it does not affect how hard a fact is to find.
 *               basics     who/where/when — the top-of-the-file stuff
 *               work       tools, stack, habits, war stories
 *               interests  what you do when you're not at a keyboard
 *               trivia     small, silly, specific
 *               opinions   the spicy ones
 *
 *   rarity    THIS IS THE GAME MECHANIC. It gates which board a fact can
 *             appear on, so harder disks are the only way to see everything:
 *               common     can surface on ANY board (Easy, Medium, Hard)
 *               uncommon   Medium and Hard only
 *               rare       Hard only
 *             So: put your throwaway answers in `common` and save the ones
 *             actually worth digging for — the embarrassing story, the strong
 *             opinion, the hidden talent — for `rare`. A player who only ever
 *             clears the 9×9 should finish knowing there's more down there.
 *
 * BALANCE NOTES
 *
 *   - The Easy board has 71 safe cells but can only draw from `common`. Once
 *     the common pool is exhausted the game says so in-fiction and keeps
 *     playing, so a short common list is not a bug — but ~20 keeps Easy
 *     interesting the whole way through.
 *   - Facts are never repeated until the player has recovered every fact
 *     available at that difficulty, so ordering in this array doesn't matter.
 *   - Aim for 40+ total. Below that the Hard board runs dry early.
 *
 * OWNER: this file is yours to rewrite by hand. Everything here is a
 * placeholder in the right SHAPE — replace the text, keep the structure.
 */
import type { Fact } from './types';

export const facts: Fact[] = [
  /* ─────────────────────────────────────────────────────────────── basics ──
   * Who you are, where you are, how you got here. Mostly `common`: these are
   * the facts you're happy for a casual visitor to leave with. */

  {
    id: 'goes-by',
    label: 'Goes by',
    value: '[replace] e.g. Rishu — or the handle you use online',
    category: 'basics',
    rarity: 'common',
  },
  {
    id: 'based-in',
    label: 'Based in',
    value: '[replace] e.g. Bengaluru, India',
    category: 'basics',
    rarity: 'common',
  },
  {
    id: 'timezone',
    label: 'Timezone',
    value: '[replace] e.g. IST (UTC+5:30), permanently',
    category: 'basics',
    rarity: 'common',
  },
  {
    id: 'currently',
    label: 'Currently',
    value: '[replace] e.g. final-year CS, freelancing on the side',
    category: 'basics',
    rarity: 'common',
  },
  {
    id: 'started-coding',
    label: 'Started coding',
    value: '[replace] e.g. 2018, copying scripts off a forum',
    category: 'basics',
    rarity: 'common',
  },
  {
    id: 'fuel',
    label: 'Runs on',
    value: '[replace] e.g. filter coffee, two cups, both before noon',
    category: 'basics',
    rarity: 'common',
  },
  {
    id: 'first-computer',
    label: 'First computer',
    value: '[replace] e.g. a hand-me-down desktop with 2GB of RAM',
    category: 'basics',
    rarity: 'uncommon',
  },
  {
    id: 'working-hours',
    label: 'Working hours',
    value: '[replace] e.g. sharpest between 10pm and 2am',
    category: 'basics',
    rarity: 'uncommon',
  },
  {
    id: 'studied',
    label: 'Studied',
    value: '[replace] e.g. computer science, mostly at 3am',
    category: 'basics',
    rarity: 'uncommon',
  },
  {
    id: 'speaks',
    label: 'Speaks',
    value: '[replace] e.g. three languages, one of them badly',
    category: 'basics',
    rarity: 'rare',
  },

  /* ───────────────────────────────────────────────────────────────── work ──
   * The stack, the habits, the war stories. Keep the tooling answers `common`
   * and put the stories — first paid gig, worst outage — in `rare`. */

  {
    id: 'primary-language',
    label: 'Primary language',
    value: '[replace] e.g. Python, and it is not close',
    category: 'work',
    rarity: 'common',
  },
  {
    id: 'editor',
    label: 'Editor',
    value: '[replace] e.g. VS Code, with a vim keymap I half-know',
    category: 'work',
    rarity: 'common',
  },
  {
    id: 'daily-os',
    label: 'Daily driver',
    value: '[replace] e.g. Linux at the desk, macOS on the move',
    category: 'work',
    rarity: 'common',
  },
  {
    id: 'frontend-stack',
    label: 'Front-end of choice',
    value: '[replace] e.g. React + Tailwind, no design degree',
    category: 'work',
    rarity: 'common',
  },
  {
    id: 'unfinished-projects',
    label: 'Unfinished projects',
    value: '[replace] e.g. eleven, and I still start new ones',
    category: 'work',
    rarity: 'common',
  },
  {
    id: 'favourite-library',
    label: 'Favourite library',
    value: '[replace] e.g. the one that fits in a single file',
    category: 'work',
    rarity: 'uncommon',
  },
  {
    id: 'testing-habit',
    label: 'Testing habit',
    value: '[replace] e.g. tests after the bug, never before it',
    category: 'work',
    rarity: 'uncommon',
  },
  {
    id: 'ships-to',
    label: 'Ships to',
    value: '[replace] e.g. a small VPS I have named and grown fond of',
    category: 'work',
    rarity: 'uncommon',
  },
  {
    id: 'review-style',
    label: 'In code review',
    value: '[replace] e.g. nitpicks names, waves through architecture',
    category: 'work',
    rarity: 'uncommon',
  },
  {
    id: 'terminal-setup',
    label: 'Terminal setup',
    value: '[replace] e.g. tmux, two panes, one of them always htop',
    category: 'work',
    rarity: 'uncommon',
  },
  {
    id: 'first-paid-work',
    label: 'First paid work',
    value: '[replace] e.g. a scraper for a shop, paid in cash and biryani',
    category: 'work',
    rarity: 'rare',
  },
  {
    id: 'worst-bug',
    label: 'Worst bug shipped',
    value: '[replace] e.g. a cron job that emailed everyone. Twice.',
    category: 'work',
    rarity: 'rare',
  },

  /* ──────────────────────────────────────────────────────────── interests ──
   * Life away from the keyboard. This is the section that makes the Dossier
   * feel like a person rather than a CV. */

  {
    id: 'on-repeat',
    label: 'On repeat',
    value: '[replace] e.g. the same four albums since 2019',
    category: 'interests',
    rarity: 'common',
  },
  {
    id: 'game-of-choice',
    label: 'Game of choice',
    value: '[replace] e.g. anything with a build order',
    category: 'interests',
    rarity: 'common',
  },
  {
    id: 'reading',
    label: 'Reading',
    value: '[replace] e.g. three books at once, finishing none',
    category: 'interests',
    rarity: 'common',
  },
  {
    id: 'podcast',
    label: 'In my ears',
    value: '[replace] e.g. one podcast, listened to at 1.5x',
    category: 'interests',
    rarity: 'common',
  },
  {
    id: 'plays-instrument',
    label: 'Plays',
    value: '[replace] e.g. guitar, badly, only when nobody is home',
    category: 'interests',
    rarity: 'uncommon',
  },
  {
    id: 'signature-dish',
    label: 'Signature dish',
    value: '[replace] e.g. one pasta, perfected over 200 attempts',
    category: 'interests',
    rarity: 'uncommon',
  },
  {
    id: 'moves-by',
    label: 'Gets outside via',
    value: '[replace] e.g. long walks with no destination',
    category: 'interests',
    rarity: 'uncommon',
  },
  {
    id: 'also-makes',
    label: 'Also makes',
    value: '[replace] e.g. pixel art nobody asked for',
    category: 'interests',
    rarity: 'uncommon',
  },
  {
    id: 'collects',
    label: 'Collects',
    value: '[replace] e.g. mechanical keyboards I do not type on',
    category: 'interests',
    rarity: 'rare',
  },
  {
    id: 'best-trip',
    label: 'Best trip',
    value: '[replace] e.g. a hill town, off-season, no signal',
    category: 'interests',
    rarity: 'rare',
  },

  /* ─────────────────────────────────────────────────────────────── trivia ──
   * Small, specific, slightly silly. These reward the player for clicking one
   * more cell — keep the weird ones `rare`. */

  {
    id: 'keyboard-layout',
    label: 'Keyboard',
    value: '[replace] e.g. 65%, browns, far too loud for a call',
    category: 'trivia',
    rarity: 'common',
  },
  {
    id: 'open-tabs',
    label: 'Open tabs',
    value: '[replace] e.g. somewhere north of forty. Always.',
    category: 'trivia',
    rarity: 'common',
  },
  {
    id: 'pet',
    label: 'Pet',
    value: '[replace] e.g. one cat, entirely uninterested in me',
    category: 'trivia',
    rarity: 'common',
  },
  {
    id: 'alarms',
    label: 'Alarms set',
    value: '[replace] e.g. six, five minutes apart, all ignored',
    category: 'trivia',
    rarity: 'common',
  },
  {
    id: 'first-website',
    label: 'First website',
    value: '[replace] e.g. a fan page with a visitor counter',
    category: 'trivia',
    rarity: 'uncommon',
  },
  {
    id: 'username-origin',
    label: 'Username origin',
    value: '[replace] e.g. a typo from 2013 I never corrected',
    category: 'trivia',
    rarity: 'uncommon',
  },
  {
    id: 'desk-situation',
    label: 'Desk situation',
    value: '[replace] e.g. two monitors, one permanently on a terminal',
    category: 'trivia',
    rarity: 'uncommon',
  },
  {
    id: 'hidden-talent',
    label: 'Hidden talent',
    value: '[replace] e.g. can name any song in four notes',
    category: 'trivia',
    rarity: 'rare',
  },
  {
    id: 'childhood-nickname',
    label: 'Childhood nickname',
    value: '[replace] e.g. something I will deny if asked',
    category: 'trivia',
    rarity: 'rare',
  },
  {
    id: 'irrational-fear',
    label: 'Irrational fear',
    value: '[replace] e.g. force-pushing to main',
    category: 'trivia',
    rarity: 'rare',
  },

  /* ────────────────────────────────────────────────────────────── opinions ──
   * The takes. Mild ones `common`, actual hills to die on `rare` — a visitor
   * should have to earn those on the 16×30. */

  {
    id: 'tabs-or-spaces',
    label: 'Tabs or spaces',
    value: '[replace] e.g. spaces, four, no further questions',
    category: 'opinions',
    rarity: 'common',
  },
  {
    id: 'dark-mode',
    label: 'Dark mode',
    value: '[replace] e.g. always, in everything, including PDFs',
    category: 'opinions',
    rarity: 'common',
  },
  {
    id: 'on-css',
    label: 'On CSS',
    value: '[replace] e.g. it is a real language and I respect it',
    category: 'opinions',
    rarity: 'common',
  },
  {
    id: 'python-typing',
    label: 'Type hints',
    value: '[replace] e.g. worth it the moment a file passes 200 lines',
    category: 'opinions',
    rarity: 'uncommon',
  },
  {
    id: 'underrated-language',
    label: 'Underrated',
    value: '[replace] e.g. the language everyone calls boring',
    category: 'opinions',
    rarity: 'uncommon',
  },
  {
    id: 'on-meetings',
    label: 'On meetings',
    value: '[replace] e.g. should have been a well-written paragraph',
    category: 'opinions',
    rarity: 'uncommon',
  },
  {
    id: 'framework-take',
    label: 'Framework take',
    value: '[replace] e.g. pick the boring one, ship the interesting thing',
    category: 'opinions',
    rarity: 'uncommon',
  },
  {
    id: 'on-ai-tools',
    label: 'On AI tooling',
    value: '[replace] e.g. a genuinely useful, occasionally confident liar',
    category: 'opinions',
    rarity: 'rare',
  },
  {
    id: 'hill-to-die-on',
    label: 'Hill to die on',
    value: '[replace] e.g. the take that has cost me friendships',
    category: 'opinions',
    rarity: 'rare',
  },
];

export default facts;
