/**
 * Schemas for everything in content/.
 *
 * FROZEN in Phase 0. These types are the contract between the person (or agent)
 * filling in real content and the components rendering it. Components must never
 * require a field that isn't described here.
 *
 * If you are filling in real content: you only ever edit the DATA files
 * (bio.ts, projects.ts, facts.ts, terminal.ts). You never edit this file, and
 * you never edit a component.
 */

/* ------------------------------------------------------------------ bio ---- */

export interface SocialLink {
  /** Display label, e.g. "GitHub". */
  label: string;
  /** Full URL including https://. */
  url: string;
  /** Handle shown next to the label, e.g. "@rishu-n". Optional. */
  handle?: string;
}

export interface Bio {
  /** Your name, shown in the menu bar dropdown and the Browser homepage. */
  name: string;
  /** One line under your name, e.g. "Backend engineer & occasional pixel artist". */
  tagline: string;
  /** Where you are, e.g. "Bengaluru, India". Optional. */
  location?: string;
  /** Current role or status line, e.g. "CS undergrad · building things in Python". */
  status?: string;
  /**
   * About Me body copy. Each string is one paragraph. Keep them short — this is
   * rendered in a 90s browser window, not a blog.
   */
  about: string[];
  /** Bullet list of things you work with. Rendered as a two-column list. */
  skills: string[];
  /** Links shown in the menu-bar dropdown and the Browser's Links page. */
  socials: SocialLink[];
  /** Email address shown on the Contact page. Optional. */
  email?: string;
  /** Small fun list rendered on the Browser homepage sidebar. Optional. */
  nowPlaying?: string[];
}

/* -------------------------------------------------------------- projects ---- */

export interface ProjectLink {
  label: string;
  url: string;
}

export interface Project {
  /**
   * kebab-case, unique. Becomes the app id, so it is also what
   * `open <id>` accepts in the terminal. Keep it short and typeable.
   */
  id: string;
  /** Shown in the window title bar and the dock. */
  title: string;
  /** One sentence, shown in the project window header and the terminal `ls`. */
  blurb: string;
  /** Body copy. Each string is one paragraph. */
  description: string[];
  /** Primary language — drives the icon colour, e.g. "Python", "TypeScript". */
  language: string;
  /** Stack/tooling chips, e.g. ["pandas", "FastAPI", "Postgres"]. */
  tech: string[];
  /** Repo / demo / writeup links. Any number, including zero. */
  links: ProjectLink[];
  /** Path to a screenshot, from content/images.ts. */
  screenshot: string;
  /** Year or range shown in the header, e.g. "2024" or "2023–24". */
  year: string;
  /** Short status chip, e.g. "shipped", "archived", "in progress". Optional. */
  status?: string;
}

/* ----------------------------------------------------------------- facts ---- */

/**
 * Rarity controls how deep in the Fact-sweeper board a fact hides. `common`
 * facts surface on easy boards; `rare` ones only appear on harder grids, so
 * there is a reason to keep playing.
 */
export type FactRarity = 'common' | 'uncommon' | 'rare';

export type FactCategory =
  | 'basics'
  | 'work'
  | 'interests'
  | 'trivia'
  | 'opinions';

export interface Fact {
  /** kebab-case, unique. Used as the persistence key for "already revealed". */
  id: string;
  /** Left-hand label in the Dossier, e.g. "First language". */
  label: string;
  /** Right-hand value, e.g. "Python, age 14". Keep it to one line. */
  value: string;
  category: FactCategory;
  rarity: FactRarity;
}

/* -------------------------------------------------------------- terminal ---- */

export interface TerminalPersona {
  /** ASCII/text banner printed when the terminal opens. */
  banner: string[];
  /**
   * System prompt for the LLM. Bio and project context are appended
   * automatically — describe voice and rules here, not facts.
   */
  systemPrompt: string;
  /**
   * Replies used when no ANTHROPIC_API_KEY is configured, so the terminal stays
   * in character offline. One is picked at random.
   */
  offlineReplies: string[];
}
