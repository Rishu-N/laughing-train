#!/usr/bin/env node
/**
 * Turns content/conversations.ts into real WhatsApp chat exports:
 *
 *   public/downloads/<conversation id>.zip     one genuine iOS-format export
 *
 * Run with: node scripts/generate-sample-chats.mjs   (npm run samples)
 *
 * ── WHY A ZIP ──────────────────────────────────────────────────────────────
 * The simulator's importer accepts .zip only, and the whole point of the
 * samples is that they go through the same door a visitor's own export does.
 * So this writes the real thing — a zip containing a `_chat.txt` in WhatsApp's
 * own format — rather than some convenient intermediate the app would need a
 * special case for.
 *
 * ── THE FORMAT IS NOT GUESSED ──────────────────────────────────────────────
 * components/apps/whatsapp/lib/parse/whatsapp.ts is the spec, and this script
 * imports that exact parser (compiled on the fly with the project's own
 * TypeScript) to read every zip back before it is written. A sample that fails
 * to import would be worse than no sample, so "it looked right" is not the
 * check — the check is that the parser produces the message count, senders,
 * types and flags the conversation asked for. Any mismatch throws.
 *
 * ── FILES ──────────────────────────────────────────────────────────────────
 * Per HANDOFF §16.5: this script writes ONLY public/downloads/*.zip. No other
 * generator touches that directory, so the two image generators and this one
 * can run in any order without clobbering each other.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { zipSync, strToU8 } from 'fflate';
import ts from 'typescript';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'downloads');

/* ─────────────────────────────────────────────────── loading the TS sources ──
 * The conversations and the parser are TypeScript, and this is a plain .mjs
 * script. Rather than keep a duplicate of either in JS (which would rot), they
 * are transpiled with the repo's own `typescript` into a scratch directory and
 * imported from there. Type stripping only — no type checking, that is what
 * `npx tsc --noEmit` is for.
 */
function loadTypeScript(files, entry) {
  const dir = mkdtempSync(join(tmpdir(), 'wa-samples-'));
  try {
    for (const [relOut, absIn] of Object.entries(files)) {
      const source = readFileSync(absIn, 'utf8');
      const { outputText } = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
        fileName: absIn,
      });
      // Extensionless relative specifiers are a bundler convention; Node needs
      // the real filename.
      const fixed = outputText.replace(
        /(from\s+["'])(\.[^"']*?)(["'])/g,
        (_m, a, spec, b) => `${a}${spec.endsWith('.js') ? spec : `${spec}.js`}${b}`,
      );
      const target = join(dir, relOut);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, fixed, 'utf8');
    }
    return { dir, url: pathToFileURL(join(dir, entry)).href };
  } catch (err) {
    rmSync(dir, { recursive: true, force: true });
    throw err;
  }
}

const WA = join(ROOT, 'components', 'apps', 'whatsapp');

const conversationsBundle = loadTypeScript(
  { 'conversations.js': join(ROOT, 'content', 'conversations.ts') },
  'conversations.js',
);
const parserBundle = loadTypeScript(
  {
    'model.js': join(WA, 'lib', 'model.ts'),
    'parse/whatsapp.js': join(WA, 'lib', 'parse', 'whatsapp.ts'),
  },
  'parse/whatsapp.js',
);

const { conversations } = await import(conversationsBundle.url);
const { parseChat } = await import(parserBundle.url);
const { MsgType, Flag, NO_SENDER } = await import(
  pathToFileURL(join(parserBundle.dir, 'model.js')).href
);

/* ──────────────────────────────────────────────────────── the export format ──
 * iOS bracket format, which is what the parser's HEADER_BRACKET matches:
 *
 *   [DD/MM/YYYY, HH:MM:SS] Sender: message
 *
 * Details that are easy to get wrong and that the parser genuinely depends on:
 *
 *   • U+200E LEFT-TO-RIGHT MARK. WhatsApp prefixes attachment and system lines
 *     with it. The parser strips it, but a sample without it would not be
 *     exercising that code at all.
 *   • \r\n between messages, bare \n inside a multi-line body. That asymmetry
 *     is exactly how the parser tells a new message from a continuation line.
 *   • "<media> omitted" is how an export made without media refers to a file.
 *   • "<This message was edited>" is a suffix, not a flag.
 *   • A deleted message's body differs depending on who deleted it.
 */
const LRM = '‎';

const pad = (n, w = 2) => String(n).padStart(w, '0');

function bodyFor(message, conversation) {
  if (message.deleted) {
    // WhatsApp words this from the reader's point of view.
    return message.from === conversation.me
      ? `${LRM}You deleted this message.`
      : `${LRM}This message was deleted.`;
  }

  let body = message.text ?? '';

  if (message.omitted) {
    // A caption, when there is one, sits in front of the token — which is the
    // prefix the parser's OMITTED_PATTERN captures.
    const token = `${LRM}${message.omitted} omitted`;
    body = body ? `${body} ${token}` : token;
  }

  if (message.edited) body += `${LRM} <This message was edited>`;
  return body;
}

/**
 * Seconds are not in content/conversations.ts and are never displayed, but two
 * messages in the same minute still have to be strictly ordered — the model,
 * the date-range binary search and the merge dedup all assume ascending
 * timestamps. Numbering within each minute gives that deterministically.
 */
function timestamps(conversation) {
  const base = new Date(`${conversation.startDate}T00:00:00`);
  if (Number.isNaN(base.getTime())) {
    throw new Error(`${conversation.id}: startDate "${conversation.startDate}" is not a date`);
  }

  const out = [];
  let lastMinuteKey = '';
  let secondsInMinute = 0;
  let previous = -Infinity;
  // `day` carries forward: content/conversations.ts marks a new day once, at
  // the top of each run, "without you writing out every one".
  let day = 0;

  for (const message of conversation.messages) {
    const [hh, mm] = message.at.split(':').map(Number);
    if (!Number.isInteger(hh) || !Number.isInteger(mm)) {
      throw new Error(`${conversation.id}: "${message.at}" is not an HH:MM time`);
    }
    if (message.day !== undefined) day = message.day;
    const key = `${day}|${message.at}`;
    secondsInMinute = key === lastMinuteKey ? secondsInMinute + 1 : 0;
    lastMinuteKey = key;
    if (secondsInMinute > 59) {
      throw new Error(`${conversation.id}: more than 60 messages at ${message.at} on day ${day}`);
    }

    const at = new Date(base);
    at.setDate(at.getDate() + day);
    at.setHours(hh, mm, secondsInMinute, 0);

    if (at.getTime() <= previous) {
      throw new Error(
        `${conversation.id}: message at day ${day} ${message.at} goes backwards in time. ` +
          'WhatsApp exports are always chronological and the parser relies on it.',
      );
    }
    previous = at.getTime();
    out.push(at);
  }
  return out;
}

function chatText(conversation) {
  const times = timestamps(conversation);

  return conversation.messages
    .map((message, i) => {
      const at = times[i];
      const stamp =
        `[${pad(at.getDate())}/${pad(at.getMonth() + 1)}/${at.getFullYear()}, ` +
        `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}]`;

      // A system notice has no "Sender: " — that absence is the entire signal
      // the parser uses to centre it instead of drawing a bubble.
      if (message.from === 'system') {
        return `${LRM}${stamp} ${LRM}${message.text}`;
      }

      if (message.from.includes(':')) {
        throw new Error(
          `${conversation.id}: sender "${message.from}" contains a colon, which makes the ` +
            'sender/body split ambiguous.',
        );
      }
      if (!conversation.participants.includes(message.from)) {
        throw new Error(
          `${conversation.id}: "${message.from}" sends a message but is not in participants.`,
        );
      }

      return `${stamp} ${message.from}: ${bodyFor(message, conversation)}`;
    })
    .join('\r\n')
    .concat('\r\n');
}

/* ───────────────────────────────────────────────────────────── verification ──
 * Read the zip's own text back through the real parser and check it produced
 * what the conversation described. This is the difference between a sample
 * that looks right and one that opens.
 */
function verify(conversation, text) {
  const model = parseChat(text);
  const problems = [];

  if (model.count !== conversation.messages.length) {
    problems.push(`parsed ${model.count} messages, expected ${conversation.messages.length}`);
  }

  const expectedSenders = [];
  for (const m of conversation.messages) {
    if (m.from !== 'system' && !expectedSenders.includes(m.from)) expectedSenders.push(m.from);
  }
  if (model.senders.join('|') !== expectedSenders.join('|')) {
    problems.push(`senders [${model.senders}] != [${expectedSenders}]`);
  }

  const OMITTED_TYPE = {
    image: MsgType.IMAGE,
    video: MsgType.VIDEO,
    sticker: MsgType.STICKER,
    audio: MsgType.AUDIO,
    document: MsgType.DOCUMENT,
    GIF: MsgType.GIF,
  };

  for (let i = 0; i < Math.min(model.count, conversation.messages.length); i++) {
    const want = conversation.messages[i];
    const gotType = model.type[i];
    const gotFlags = model.flags[i];
    const at = `${conversation.id}[${i}]`;

    if (want.from === 'system') {
      if (gotType !== MsgType.SYSTEM) problems.push(`${at}: expected SYSTEM, got type ${gotType}`);
      if (model.senderId[i] !== NO_SENDER) problems.push(`${at}: system message got a sender`);
      if (model.bodies[i] !== want.text) problems.push(`${at}: system body "${model.bodies[i]}"`);
      continue;
    }

    if (model.senders[model.senderId[i]] !== want.from) {
      problems.push(`${at}: sender "${model.senders[model.senderId[i]]}" != "${want.from}"`);
    }

    if (want.deleted) {
      if (gotType !== MsgType.DELETED) problems.push(`${at}: expected DELETED, got ${gotType}`);
      continue;
    }

    if (want.omitted) {
      if (gotType !== OMITTED_TYPE[want.omitted]) {
        problems.push(`${at}: expected ${want.omitted} type, got ${gotType}`);
      }
      if (!(gotFlags & Flag.OMITTED)) problems.push(`${at}: OMITTED flag not set`);
      if (model.bodies[i] !== (want.text ?? '')) {
        problems.push(`${at}: caption "${model.bodies[i]}" != "${want.text ?? ''}"`);
      }
      continue;
    }

    if (gotType !== MsgType.TEXT) problems.push(`${at}: expected TEXT, got ${gotType}`);
    if (model.bodies[i] !== want.text) {
      problems.push(`${at}: body "${model.bodies[i]}" != "${want.text}"`);
    }
    const edited = (gotFlags & Flag.EDITED) !== 0;
    if (edited !== !!want.edited) problems.push(`${at}: edited flag ${edited}, expected ${!!want.edited}`);
  }

  if (problems.length > 0) {
    throw new Error(
      `${conversation.id} does not round-trip through the parser:\n  - ${problems.join('\n  - ')}`,
    );
  }

  return model;
}

/* ────────────────────────────────────────────────────────────────── writing ── */

mkdirSync(OUT_DIR, { recursive: true });

const seen = new Set();
let written = 0;

for (const conversation of conversations) {
  if (seen.has(conversation.id)) {
    throw new Error(`Duplicate conversation id "${conversation.id}" in content/conversations.ts`);
  }
  seen.add(conversation.id);

  if (!conversation.participants.includes(conversation.me)) {
    throw new Error(
      `${conversation.id}: me "${conversation.me}" is not one of participants ` +
        `[${conversation.participants}]`,
    );
  }

  const text = chatText(conversation);
  const model = verify(conversation, text);

  // mtime is fixed so re-running the generator without editing content
  // produces a byte-identical file rather than a spurious diff.
  const zip = zipSync(
    { '_chat.txt': strToU8(text) },
    { level: 9, mtime: new Date('2026-01-01T00:00:00Z') },
  );

  const file = join(OUT_DIR, `${conversation.id}.zip`);
  writeFileSync(file, zip);
  written++;

  const dates =
    model.count > 0
      ? `${new Date(model.ts[0]).toISOString().slice(0, 10)} → ${new Date(model.ts[model.count - 1]).toISOString().slice(0, 10)}`
      : 'empty';
  console.log(
    `  ${conversation.id}.zip  ${String(zip.length).padStart(6)} bytes  ` +
      `${String(model.count).padStart(3)} messages  ${dates}  ` +
      `${model.dateOrder}${model.dateOrderCertain ? '' : ' (inferred)'}`,
  );
}

rmSync(conversationsBundle.dir, { recursive: true, force: true });
rmSync(parserBundle.dir, { recursive: true, force: true });

console.log(`Wrote ${written} sample export${written === 1 ? '' : 's'} to public/downloads/.`);
