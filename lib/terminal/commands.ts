/**
 * The Terminal's local command table.
 *
 * Everything typed into the terminal is parsed here FIRST. Only input that
 * matches no command falls through to the LLM route, which keeps the common
 * cases instant, free and offline-safe.
 *
 * OWNER: Terminal agent.
 */
import { bio } from '@/content/bio';
import { projects } from '@/content/projects';
import { facts } from '@/content/facts';
import { terminalPersona } from '@/content/terminal';
import { allApps, appIds, getApp } from '@/lib/os/registry';
import { useWindowStore } from '@/lib/os/windowStore';
import type {
  CommandContext,
  CommandOutcome,
  OutputLine,
  ParseResult,
} from './types';

/* ----------------------------------------------------------------- utils -- */

const out = (text: string): OutputLine => ({ kind: 'output', text });
const sys = (text: string): OutputLine => ({ kind: 'system', text });
const err = (text: string): OutputLine => ({ kind: 'error', text });

/** Fixed-width first column, so `ls` and `help` line up like a real shell. */
const COL = 14;
function col(left: string, right: string): string {
  return `  ${left.padEnd(COL)}${right}`;
}

function pick<T>(list: readonly T[]): T | undefined {
  if (list.length === 0) return undefined;
  return list[Math.floor(Math.random() * list.length)];
}

/* -------------------------------------------------------------- commands -- */

export interface CommandSpec {
  name: string;
  /** Shown in `help`, e.g. "open <app>". */
  usage: string;
  summary: string;
  run: (args: string[], ctx: CommandContext, rest: string) => CommandOutcome;
}

/**
 * Declared as a plain array so `help` and tab-completion can both read it.
 * Order here is the order shown by `help`.
 */
export const COMMANDS: CommandSpec[] = [
  {
    name: 'help',
    usage: 'help',
    summary: 'this list',
    run: () => ({ lines: helpLines() }),
  },
  {
    name: 'ls',
    usage: 'ls',
    summary: 'list installed applications',
    run: () => {
      const apps = allApps();
      if (apps.length === 0) {
        return { lines: [err('NO APPLICATIONS REGISTERED.')] };
      }
      return {
        lines: [
          sys(`${apps.length} application${apps.length === 1 ? '' : 's'} installed:`),
          ...apps.map((a) => out(col(a.id, a.description ?? a.title))),
          sys('Use `open <name>` to launch one.'),
        ],
      };
    },
  },
  {
    name: 'open',
    usage: 'open <app>',
    summary: 'launch an application by name',
    run: (args) => {
      const id = (args[0] ?? '').toLowerCase();
      if (!id) {
        return {
          lines: [
            err('USAGE: open <app>'),
            out(`Known apps: ${appIds().join(', ') || '(none)'}`),
          ],
        };
      }
      const app = getApp(id);
      if (!app) {
        return {
          lines: [
            err(`NO SUCH APPLICATION: ${id}`),
            out(`Known apps: ${appIds().join(', ') || '(none)'}`),
          ],
        };
      }
      useWindowStore.getState().openApp(app.id);
      return { lines: [sys(`Launching ${app.title}...`)] };
    },
  },
  {
    name: 'whoami',
    usage: 'whoami',
    summary: 'identify the owner of this machine',
    run: () => {
      const lines: OutputLine[] = [out(bio.name), out(bio.tagline)];
      if (bio.status) lines.push(out(bio.status));
      if (bio.location) lines.push(out(col('location', bio.location)));
      if (bio.email) lines.push(out(col('mail', bio.email)));
      for (const link of bio.socials) {
        lines.push(out(col(link.label.toLowerCase(), link.handle ?? link.url)));
      }
      return { lines };
    },
  },
  {
    name: 'about',
    usage: 'about',
    summary: 'read the long version',
    run: () => {
      const lines: OutputLine[] = [];
      for (const paragraph of bio.about) {
        lines.push(out(paragraph), out(''));
      }
      if (bio.skills.length > 0) {
        lines.push(sys('Works with:'), out(`  ${bio.skills.join(' · ')}`));
      }
      if (lines.length === 0) lines.push(err('DOSSIER EMPTY.'));
      return { lines };
    },
  },
  {
    name: 'projects',
    usage: 'projects',
    summary: 'list projects on this disk',
    run: () => {
      if (projects.length === 0) {
        return {
          lines: [
            err('NO PROJECTS INDEXED.'),
            out('The disk is still spinning up. Check back shortly.'),
          ],
        };
      }
      return {
        lines: [
          sys(`${projects.length} project${projects.length === 1 ? '' : 's'} on file:`),
          ...projects.flatMap((p) => [
            out(col(p.id, `${p.title} (${p.year})`)),
            out(col('', p.blurb)),
          ]),
          sys('Use `open <id>` to read one.'),
        ],
      };
    },
  },
  {
    name: 'facts',
    usage: 'facts',
    summary: 'pull a random record from the dossier',
    run: () => {
      const fact = pick(facts);
      if (!fact) {
        return {
          lines: [
            err('DOSSIER NOT LOADED.'),
            out('Try the Fact-sweeper game once it is installed.'),
          ],
        };
      }
      return {
        lines: [
          sys(`RECORD ${fact.id} · ${fact.category} · ${fact.rarity}`),
          out(col(fact.label, fact.value)),
          sys(`${facts.length} record${facts.length === 1 ? '' : 's'} on file.`),
        ],
      };
    },
  },
  {
    name: 'date',
    usage: 'date',
    summary: 'ask the system clock',
    run: () => ({ lines: [out(new Date().toString())] }),
  },
  {
    name: 'echo',
    usage: 'echo <text>',
    summary: 'repeat yourself',
    run: (_args, _ctx, rest) => ({ lines: [out(rest)] }),
  },
  {
    name: 'history',
    usage: 'history',
    summary: 'show recent commands',
    run: (_args, ctx) => {
      if (ctx.history.length === 0) {
        return { lines: [sys('No commands yet.')] };
      }
      return {
        lines: ctx.history.map((entry, i) =>
          out(`  ${String(i + 1).padStart(3)}  ${entry}`),
        ),
      };
    },
  },
  {
    name: 'crt',
    usage: 'crt [on|off]',
    summary: 'toggle scanlines and glow',
    run: (args, ctx) => {
      const arg = (args[0] ?? '').toLowerCase();
      if (arg === 'on' || arg === 'off') {
        return {
          crt: arg,
          lines: [sys(`CRT effects ${arg.toUpperCase()}.`)],
        };
      }
      if (arg) {
        return { lines: [err('USAGE: crt [on|off]')] };
      }
      return {
        crt: 'toggle',
        lines: [sys(`CRT effects ${ctx.crt ? 'OFF' : 'ON'}.`)],
      };
    },
  },
  {
    name: 'clear',
    usage: 'clear',
    summary: 'wipe the screen',
    run: () => ({ clear: true, lines: [] }),
  },
  {
    name: 'exit',
    usage: 'exit',
    summary: 'close this window',
    run: () => ({ exit: true, lines: [sys('Goodbye.')] }),
  },
];

const BY_NAME = new Map(COMMANDS.map((c) => [c.name, c]));

/** Every command name, sorted — used by `help` and tab completion. */
export function commandNames(): string[] {
  return COMMANDS.map((c) => c.name).sort();
}

/* ------------------------------------------------------------ help/banner -- */

/** The help block. Printed by `help` and once on open. */
export function helpLines(): OutputLine[] {
  return [
    sys('COMMANDS'),
    ...COMMANDS.map((c) => out(col(c.usage, c.summary))),
    sys('Anything else is passed to the assistant.'),
  ];
}

/** Banner + help, printed when the window opens. */
export function bootLines(): OutputLine[] {
  return [
    ...terminalPersona.banner.map((line) => sys(line)),
    ...helpLines(),
    out(''),
  ];
}

/* ---------------------------------------------------------------- parsing -- */

/**
 * Parse and run one submitted line. Local commands are handled here; anything
 * unrecognised is returned as `llm` so the caller can hit /api/terminal.
 */
export function runCommand(raw: string, ctx: CommandContext): ParseResult {
  const input = raw.trim();
  if (!input) return { type: 'blank' };

  const [head, ...args] = input.split(/\s+/);
  const name = head.toLowerCase();
  const spec = BY_NAME.get(name);
  if (!spec) return { type: 'llm', input };

  // Everything after the command word, whitespace preserved — `echo` needs it.
  const rest = input.slice(head.length).replace(/^\s/, '');
  return { type: 'command', name, outcome: spec.run(args, ctx, rest) };
}

/* ------------------------------------------------------------- completion -- */

export interface Completion {
  /** The input line after completing, possibly unchanged. */
  value: string;
  /** Candidates to print when the completion was ambiguous. */
  suggestions: string[];
}

/** Longest string that every candidate starts with. */
function commonPrefix(list: string[]): string {
  if (list.length === 0) return '';
  let prefix = list[0];
  for (const item of list.slice(1)) {
    while (prefix && !item.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return prefix;
}

/**
 * Tab completion. Completes command names in the first position, and app ids
 * as the argument to `open`. Returns the input unchanged when nothing matches.
 */
export function complete(input: string): Completion {
  const trailingSpace = /\s$/.test(input);
  const tokens = input.trim().length === 0 ? [] : input.trim().split(/\s+/);

  // Which token are we completing, and what has been typed of it so far?
  const completingArg = tokens.length > 1 || (tokens.length === 1 && trailingSpace);
  const partial = trailingSpace ? '' : (tokens[tokens.length - 1] ?? '');

  let pool: string[];
  if (!completingArg) {
    pool = commandNames();
  } else if (tokens[0].toLowerCase() === 'open') {
    pool = appIds();
  } else {
    return { value: input, suggestions: [] };
  }

  const matches = pool.filter((c) => c.startsWith(partial.toLowerCase()));
  if (matches.length === 0) return { value: input, suggestions: [] };

  const filled = matches.length === 1 ? matches[0] : commonPrefix(matches);
  const head = completingArg ? `${tokens[0].toLowerCase()} ` : '';
  const value = matches.length === 1 ? `${head}${filled} ` : `${head}${filled}`;

  return {
    value,
    suggestions: matches.length === 1 ? [] : matches,
  };
}
