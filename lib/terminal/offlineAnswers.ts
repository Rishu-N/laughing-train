/**
 * The terminal's local brain.
 *
 * When there is no ANTHROPIC_API_KEY — which is the default, and the only mode
 * that works on a plane — unrecognised input lands here instead of at a model.
 * Rather than always firing back a "no carrier" quip, this answers the handful
 * of things people actually type at a portfolio terminal, using nothing but the
 * data already in content/.
 *
 * No network. No API. Pure function, so it can be reasoned about and tested.
 *
 * This is a keyword matcher, not an AI. It is meant to be *useful and honest*,
 * not to pretend to be clever — if it doesn't know, it says so in character and
 * points at a real command.
 *
 * To teach it something new: add a rule to TOPICS. Rules are checked in order,
 * so put the specific ones first.
 */
import { bio } from '@/content/bio';
import { facts } from '@/content/facts';
import { projects } from '@/content/projects';
import { terminalPersona } from '@/content/terminal';

interface Topic {
  /** Any of these appearing in the input triggers the rule. */
  keywords: string[];
  /** Built lazily so content edits are always reflected. */
  answer: () => string;
}

const list = (items: string[], max = 6): string =>
  items.slice(0, max).join(', ') + (items.length > max ? `, +${items.length - max} more` : '');

const TOPICS: Topic[] = [
  {
    keywords: ['who are you', 'who is this', 'your name', 'whoami', 'who am i talking'],
    answer: () => `${bio.name}. ${bio.tagline}`,
  },
  {
    keywords: ['what do you do', 'about', 'tell me about', 'bio', 'background', 'yourself'],
    answer: () => bio.about[0] ?? `${bio.name}. ${bio.tagline}`,
  },
  {
    keywords: ['skill', 'stack', 'tech', 'language', 'tools', 'know how to'],
    answer: () =>
      bio.skills.length > 0
        ? `Works with: ${list(bio.skills, 8)}.`
        : 'NO SKILLS ON FILE. Check content/bio.ts.',
  },
  {
    keywords: ['project', 'work', 'built', 'portfolio', 'made', 'shipped'],
    answer: () => {
      if (projects.length === 0) return 'NO PROJECTS ON FILE YET.';
      return `${projects.length} on this disk: ${list(projects.map((p) => p.title))}.
Type: open ${projects[0].id}`;
    },
  },
  {
    keywords: ['contact', 'email', 'reach', 'hire', 'get in touch', 'message you'],
    answer: () => {
      const parts: string[] = [];
      if (bio.email) parts.push(bio.email);
      if (bio.socials.length > 0) parts.push(list(bio.socials.map((s) => s.label), 4));
      return parts.length > 0
        ? `Reach me at: ${parts.join(' · ')}`
        : 'NO CONTACT DETAILS ON FILE.';
    },
  },
  {
    keywords: ['where', 'location', 'based', 'live', 'from', 'timezone'],
    answer: () => (bio.location ? `Based in ${bio.location}.` : 'LOCATION NOT ON FILE.'),
  },
  {
    keywords: ['github', 'linkedin', 'social', 'link', 'twitter', 'blog'],
    answer: () =>
      bio.socials.length > 0
        ? bio.socials.map((s) => `${s.label}: ${s.url}`).slice(0, 4).join('\n')
        : 'NO LINKS ON FILE.',
  },
  {
    keywords: ['game', 'play', 'snake', '2048', 'minesweeper', 'sweeper', 'bored'],
    answer: () =>
      `Three on this disk: Fact-sweeper, Snake, 2048.
Fact-sweeper hides ${facts.length} things about me. Type: open factsweeper`,
  },
  {
    keywords: ['fact', 'dossier', 'secret', 'personal', 'trivia'],
    answer: () =>
      `${facts.length} facts are buried in Fact-sweeper. Clear a sector, recover one.
Type: open factsweeper — harder disks hide the better ones.`,
  },
  {
    // ' ai ' is space-padded so it can't fire on "email", "explain", "again".
    // The input is padded with spaces before matching, so this hits a bare word.
    keywords: [
      'api',
      'key',
      'offline',
      'model',
      'llm',
      ' ai ',
      'a bot',
      'a robot',
      'a human',
      'real person',
      'chatgpt',
      'claude',
      'gpt',
    ],
    // Reached both when no key is set AND when a key is set but unreachable,
    // so this must not claim to know which. Saying "no key configured" to
    // someone sitting on a plane with a key in .env.local would be a lie.
    answer: () =>
      `RUNNING LOCAL. Answering from what is on this disk, not from a model.
That happens with no API key, or no connection. Both are fine — try: help`,
  },
  {
    keywords: ['how was this', 'how did you build', 'what is this site', 'made with', 'source'],
    answer: () =>
      `A fake operating system. Next.js and TypeScript, all client-side.
Everything you can read lives in content/ — type help for commands.`,
  },
  {
    keywords: ['hello', 'hi ', 'hey', 'yo ', 'greetings', 'good morning', 'good evening'],
    answer: () => `Hello. Type help for what I can do, or ask me about ${bio.name}.`,
  },
  {
    keywords: ['thank', 'cheers', 'nice', 'cool', 'love this', 'awesome'],
    answer: () => 'ACKNOWLEDGED. Carry on.',
  },
  {
    keywords: ['help', 'what can you', 'commands', 'lost', 'stuck'],
    answer: () => 'Type help for the command list, or ls to see what is installed.',
  },
];

/** Deterministic-ish quip, used when nothing matches. */
function quip(rng: () => number = Math.random): string {
  const pool = terminalPersona.offlineReplies;
  if (pool.length === 0) return 'NO CARRIER.';
  return pool[Math.floor(rng() * pool.length)] as string;
}

/**
 * Answer `input` using only local content.
 *
 * Returns a matched answer when it recognises the question, and an
 * in-character quip when it doesn't — never an error, never a network call.
 */
export function answerOffline(input: string, rng: () => number = Math.random): string {
  const text = ` ${input.toLowerCase().replace(/[^\w\s@.:/-]/g, ' ').replace(/\s+/g, ' ')} `;

  for (const topic of TOPICS) {
    if (topic.keywords.some((k) => text.includes(k))) {
      try {
        return topic.answer();
      } catch {
        // A malformed content/ edit must never take the terminal down.
        return quip(rng);
      }
    }
  }
  return quip(rng);
}

/** Exposed for tests: how many topics the local brain knows. */
export const OFFLINE_TOPIC_COUNT = TOPICS.length;
