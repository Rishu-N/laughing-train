/**
 * The ONLY server-side code in this project.
 *
 * The Terminal parses commands locally; anything it does not recognise is
 * POSTed here and answered by Claude, grounded in content/bio.ts and
 * content/projects.ts.
 *
 * Two things matter more than the feature itself:
 *
 *  1. ANTHROPIC_API_KEY is read here and NOWHERE else. It is never sent to the
 *     client, never echoed in a response, never logged, and there is no
 *     NEXT_PUBLIC_ variant of it anywhere in the repo.
 *  2. There is no failure path that 500s. No key, bad key, rate-limited,
 *     upstream on fire — every one of them answers 200 with an in-character
 *     line and `offline: true`, so the terminal is fun out of the box.
 *
 * OWNER: Terminal agent.
 */
import Anthropic from '@anthropic-ai/sdk';
import { bio } from '@/content/bio';
import { projects } from '@/content/projects';
import { terminalPersona } from '@/content/terminal';

export const runtime = 'nodejs';

/* --------------------------------------------------------------- limits --- */

/** Longest user message we will look at. Anything longer is a 400. */
const MAX_INPUT = 2000;
/** How many past turns we keep, whatever the client claims to have sent. */
const MAX_HISTORY = 8;
/** Per-turn character cap on replayed history. */
const MAX_TURN = 600;
/** Token bucket: this many requests per IP per minute, burstable. */
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
/** Give up on the model rather than hold the terminal hostage. */
const UPSTREAM_TIMEOUT_MS = 20_000;
/** Terminal replies are one-liners; this is generous. */
const MAX_TOKENS = 300;
/** Hard ceiling on what we print back into the scrollback. */
const MAX_REPLY_LINES = 3;
const MAX_REPLY_CHARS = 400;

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

/* ----------------------------------------------------------- rate limiter -- */

interface Bucket {
  tokens: number;
  last: number;
}

/**
 * In-memory, per-instance token bucket. Deliberately simple: this is a
 * portfolio site, not a bank. It resets on redeploy and does not coordinate
 * across serverless instances, which is fine for the abuse it exists to stop.
 */
const buckets = new Map<string, Bucket>();

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() || 'local';
}

function allow(ip: string): boolean {
  const now = Date.now();

  // Cheap eviction so a long-lived instance cannot grow the map forever.
  if (buckets.size > 5000) {
    for (const [key, bucket] of buckets) {
      if (now - bucket.last > RATE_WINDOW_MS * 5) buckets.delete(key);
    }
  }

  const bucket = buckets.get(ip);
  if (!bucket) {
    buckets.set(ip, { tokens: RATE_LIMIT - 1, last: now });
    return true;
  }

  const refill = ((now - bucket.last) / RATE_WINDOW_MS) * RATE_LIMIT;
  bucket.tokens = Math.min(RATE_LIMIT, bucket.tokens + refill);
  bucket.last = now;

  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

/* ---------------------------------------------------------------- helpers -- */

function randomOffline(): string {
  const pool = terminalPersona.offlineReplies;
  if (pool.length === 0) return 'NO CARRIER.';
  return pool[Math.floor(Math.random() * pool.length)];
}

function offline(): Response {
  // 200, always. The client treats a non-200 as a hard failure, and a dead
  // model is not a hard failure — it is a 1991 machine with a bad phone line.
  return Response.json({ reply: randomOffline(), offline: true }, { status: 200 });
}

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

/** Trust nothing from the client: shape, types and length are all re-checked. */
function sanitizeHistory(value: unknown): Turn[] {
  if (!Array.isArray(value)) return [];
  const turns: Turn[] = [];
  for (const entry of value.slice(-MAX_HISTORY * 2)) {
    if (!entry || typeof entry !== 'object') continue;
    const { role, content } = entry as { role?: unknown; content?: unknown };
    if (role !== 'user' && role !== 'assistant') continue;
    if (typeof content !== 'string') continue;
    const text = content.trim().slice(0, MAX_TURN);
    if (!text) continue;
    turns.push({ role, content: text });
  }
  // The Messages API wants the conversation to start on a user turn.
  const trimmed = turns.slice(-MAX_HISTORY);
  while (trimmed.length > 0 && trimmed[0].role !== 'user') trimmed.shift();
  return trimmed;
}

/**
 * Facts get injected here rather than living in content/terminal.ts, so the
 * persona file stays voice-only and the assistant automatically learns about
 * whatever the owner puts in content/.
 */
function dossier(): string {
  const lines: string[] = ['OWNER DOSSIER', `name: ${bio.name}`, `tagline: ${bio.tagline}`];
  if (bio.status) lines.push(`status: ${bio.status}`);
  if (bio.location) lines.push(`location: ${bio.location}`);
  if (bio.email) lines.push(`email: ${bio.email}`);
  if (bio.skills.length > 0) lines.push(`skills: ${bio.skills.join(', ')}`);
  for (const link of bio.socials) {
    lines.push(`link: ${link.label} ${link.handle ?? ''} ${link.url}`.replace(/\s+/g, ' '));
  }
  if (bio.nowPlaying && bio.nowPlaying.length > 0) {
    lines.push(`currently: ${bio.nowPlaying.join(', ')}`);
  }
  for (const paragraph of bio.about.slice(0, 6)) {
    lines.push(`about: ${paragraph}`);
  }

  lines.push('', 'PROJECTS');
  if (projects.length === 0) {
    lines.push('(none indexed yet — say so plainly if asked)');
  } else {
    for (const p of projects.slice(0, 20)) {
      lines.push(
        `- ${p.id} | ${p.title} (${p.year}${p.status ? `, ${p.status}` : ''}) | ${p.language}` +
          `${p.tech.length > 0 ? ` + ${p.tech.join(', ')}` : ''} | ${p.blurb}`,
      );
    }
    lines.push('Any project can be opened in the OS with: open <id>');
  }

  return lines.join('\n');
}

/** Squash the model's answer back into terminal shape. */
function tidy(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[*_`#>]/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_REPLY_LINES)
    .join('\n')
    .slice(0, MAX_REPLY_CHARS)
    .trim();
}

/* ------------------------------------------------------------------ route -- */

export async function POST(req: Request) {
  if (!allow(clientIp(req))) {
    return Response.json(
      {
        reply: 'SLOW DOWN. THIS MACHINE HAS 8 MHz AND FEELINGS. TRY AGAIN IN A MINUTE.',
        rateLimited: true,
      },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { reply: 'MALFORMED TRANSMISSION. EXPECTED JSON.', error: 'invalid_body' },
      { status: 400 },
    );
  }

  const { input, history } = (body ?? {}) as { input?: unknown; history?: unknown };

  if (typeof input !== 'string' || input.trim().length === 0) {
    return Response.json(
      { reply: 'EMPTY INPUT BUFFER. TYPE SOMETHING FIRST.', error: 'invalid_input' },
      { status: 400 },
    );
  }
  if (input.length > MAX_INPUT) {
    return Response.json(
      {
        reply: `INPUT TOO LONG. ${MAX_INPUT} CHARACTERS MAXIMUM ON THIS TERMINAL.`,
        error: 'input_too_long',
      },
      { status: 400 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // No key configured. This is the expected state for a fresh clone, so it
    // is a normal, in-character answer rather than an error.
    return offline();
  }

  try {
    const client = new Anthropic({
      apiKey,
      timeout: UPSTREAM_TIMEOUT_MS,
      maxRetries: 1,
    });

    const message = await client.messages.create({
      model: process.env.TERMINAL_MODEL || DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      system: `${terminalPersona.systemPrompt}\n\n${dossier()}`,
      messages: [
        ...sanitizeHistory(history),
        { role: 'user' as const, content: input.trim() },
      ],
    });

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    const reply = tidy(text);
    if (!reply) return offline();

    return Response.json({ reply, offline: false }, { status: 200 });
  } catch {
    // Bad key, quota, network, upstream outage — the terminal never sees a
    // stack trace, and never a 500. It just loses carrier.
    return offline();
  }
}
