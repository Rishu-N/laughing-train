// Parser for WhatsApp `_chat.txt` exports (iOS bracket format and Android
// dash format, with or without seconds, with or without AM/PM).
//
// Strategy: split the whole file into physical lines (both \r\n and bare
// \n, since iOS exports use \r\n as the message separator but a message's
// own multi-line body uses bare \n). Walk the lines once; a line either
// starts a new message (it matches the header regex) or it's a
// continuation of the previous message's body. This is a single linear
// pass with no backtracking, which is what makes it fine at 200k+
// messages.
import { ChatModelBuilder, Flag, MsgType, NO_SENDER, type ChatModel } from "../model";

// U+200E LEFT-TO-RIGHT MARK — WhatsApp prefixes the timestamp and most
// system/media tokens with this. U+202F NARROW NO-BREAK SPACE — sits
// between the time and AM/PM on iOS exports.
const LRM = /‎/g;
const NNBSP = / /g;

const HEADER_BRACKET =
  /^‎?\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s?(\d{1,2}):(\d{2})(?::(\d{2}))?[  ]?([AaPp]\.?[Mm]\.?)?\]\s(.*)$/;
const HEADER_DASH =
  /^‎?(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s?(\d{1,2}):(\d{2})(?::(\d{2}))?[  ]?([AaPp]\.?[Mm]\.?)?\s-\s(.*)$/;

const SENDER_SPLIT = /^([^:\n]+?): ([\s\S]*)$/;

const EDITED_SUFFIX = /[\s‎]*<This message was edited>\s*$/i;
const DELETED_BODY = /^(you deleted this message\.?|this message was deleted\.?)$/i;
const CALL_PATTERN = /^(Voice call|Video call)\s*,?\s*(.*)$/i;
const OMITTED_PATTERN =
  /^(.*?)(sticker|image|video|audio|gif|contact card|document) omitted$/i;
const ATTACHED_IOS = /^(.*?)<attached:\s*([^>]+)>$/i;
const ATTACHED_ANDROID = /^(.+?)\s\(file attached\)$/i;

interface HeaderMatch {
  d1: number;
  d2: number;
  year: number;
  hour: number;
  min: number;
  sec: number;
  ampm: string | undefined;
  rest: string;
}

function matchHeader(line: string): HeaderMatch | null {
  let m = HEADER_BRACKET.exec(line);
  if (!m) m = HEADER_DASH.exec(line);
  if (!m) return null;
  return {
    d1: +m[1],
    d2: +m[2],
    year: +m[3],
    hour: +m[4],
    min: +m[5],
    sec: m[6] ? +m[6] : 0,
    ampm: m[7],
    rest: m[8],
  };
}

/** Scans headers to decide day-first vs month-first, without doing the
 * full parse. Early-exits the moment it finds an unambiguous case
 * (a first-or-second date component > 12). Exported so multi-source
 * merges can detect once across every source's lines combined, rather
 * than risking each source guessing independently and disagreeing —
 * a disagreement would corrupt relative ordering after merge. */
export function detectDateOrder(lines: string[]): { order: "DMY" | "MDY"; certain: boolean } {
  for (const line of lines) {
    const h = matchHeader(line);
    if (!h) continue;
    if (h.d1 > 12) return { order: "DMY", certain: true };
    if (h.d2 > 12) return { order: "MDY", certain: true };
  }
  return { order: "DMY", certain: false };
}

const EXT_TYPE: Record<string, MsgType> = {
  jpg: MsgType.IMAGE,
  jpeg: MsgType.IMAGE,
  png: MsgType.IMAGE,
  webp: MsgType.IMAGE,
  heic: MsgType.IMAGE,
  gif: MsgType.GIF,
  mp4: MsgType.VIDEO,
  mov: MsgType.VIDEO,
  "3gp": MsgType.VIDEO,
  avi: MsgType.VIDEO,
  opus: MsgType.AUDIO,
  m4a: MsgType.AUDIO,
  mp3: MsgType.AUDIO,
  aac: MsgType.AUDIO,
  wav: MsgType.AUDIO,
  vcf: MsgType.CONTACT,
};

export function typeFromExtension(filename: string): MsgType {
  const dot = filename.lastIndexOf(".");
  const ext = dot >= 0 ? filename.slice(dot + 1).toLowerCase() : "";
  return EXT_TYPE[ext] ?? MsgType.DOCUMENT;
}

export interface ParseOptions {
  /** Force a date order instead of auto-detecting (used by the Settings flip). */
  dateOrder?: "DMY" | "MDY";
  onProgress?: (linesDone: number, linesTotal: number) => void;
}

export function parseChat(text: string, opts: ParseOptions = {}): ChatModel {
  // Strip a leading BOM if present.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const lines = text.split(/\r\n|\n/);

  const detected = opts.dateOrder
    ? { order: opts.dateOrder, certain: true }
    : detectDateOrder(lines);

  const b = new ChatModelBuilder();
  let curSenderId = -1;
  let curBody = "";
  let curTs = 0;
  let hasCurrent = false;
  const progressEvery = 5000;

  // Classifies the fully-assembled body of one message (all continuation
  // lines already appended) into a MsgType + flags + display body. Runs
  // at flush time so it only ever sees a complete body, never a partial
  // one from a multi-line message still being joined.
  const classifyAndPush = () => {
    if (!hasCurrent) return;
    hasCurrent = false;

    if (curSenderId === NO_SENDER) {
      const body = curBody.replace(LRM, "").trim();
      b.push(curTs, NO_SENDER, MsgType.SYSTEM, 0, body, null);
      return;
    }

    let body = curBody.replace(NNBSP, " ");
    let flags = 0;

    const edited = EDITED_SUFFIX.test(body);
    if (edited) {
      body = body.replace(EDITED_SUFFIX, "");
      flags |= Flag.EDITED;
    }
    body = body.replace(LRM, "").trim();

    if (DELETED_BODY.test(body)) {
      b.push(curTs, curSenderId, MsgType.DELETED, flags, "", null);
      return;
    }

    const call = CALL_PATTERN.exec(body);
    if (call) {
      const details = call[2].trim();
      if (/no answer|missed/i.test(details)) flags |= Flag.MISSED;
      const label = details ? `${call[1]}, ${details}` : call[1];
      b.push(curTs, curSenderId, MsgType.CALL, flags, label, null);
      return;
    }

    const omitted = OMITTED_PATTERN.exec(body);
    if (omitted) {
      const kind = omitted[2].toLowerCase();
      const type =
        kind === "sticker"
          ? MsgType.STICKER
          : kind === "image"
            ? MsgType.IMAGE
            : kind === "video"
              ? MsgType.VIDEO
              : kind === "audio"
                ? MsgType.AUDIO
                : kind === "gif"
                  ? MsgType.GIF
                  : kind === "contact card"
                    ? MsgType.CONTACT
                    : MsgType.DOCUMENT;
      flags |= Flag.OMITTED;
      b.push(curTs, curSenderId, type, flags, omitted[1].trim(), null);
      return;
    }

    const attachedIos = ATTACHED_IOS.exec(body);
    const attachedAndroid = !attachedIos ? ATTACHED_ANDROID.exec(body) : null;
    if (attachedIos || attachedAndroid) {
      const caption = attachedIos ? attachedIos[1].trim() : "";
      const filename = attachedIos ? attachedIos[2].trim() : attachedAndroid![1].trim();
      flags |= Flag.HAS_FILE;
      b.push(curTs, curSenderId, typeFromExtension(filename), flags, caption, filename);
      return;
    }

    b.push(curTs, curSenderId, MsgType.TEXT, flags, body, null);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h = matchHeader(line);
    if (h) {
      classifyAndPush();

      const day = detected.order === "DMY" ? h.d1 : h.d2;
      const month = detected.order === "DMY" ? h.d2 : h.d1;
      const year = h.year < 100 ? 2000 + h.year : h.year;
      let hour = h.hour;
      if (h.ampm) {
        const isPm = /p/i.test(h.ampm);
        hour = hour % 12;
        if (isPm) hour += 12;
      }
      curTs = new Date(year, month - 1, day, hour, h.min, h.sec).getTime();

      const sm = SENDER_SPLIT.exec(h.rest);
      if (sm) {
        curSenderId = b.senderIdFor(sm[1].trim().replace(LRM, ""));
        curBody = sm[2];
      } else {
        curSenderId = NO_SENDER;
        curBody = h.rest;
      }
      hasCurrent = true;
    } else if (hasCurrent) {
      // Continuation of the previous message's multi-line body.
      curBody += "\n" + line;
    }
    // A non-matching line before any message has started (e.g. a blank
    // leading line) is silently dropped.

    if (opts.onProgress && i % progressEvery === 0) {
      opts.onProgress(i, lines.length);
    }
  }
  classifyAndPush();

  return b.finish(detected.order, detected.certain);
}
