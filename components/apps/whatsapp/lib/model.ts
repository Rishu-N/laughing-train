// Columnar message store. Parallel typed arrays instead of an array of
// objects — for a 200k-message chat this is the difference between ~40MB
// and ~250MB of heap, and it makes date-range filtering a plain scan over
// a Float64Array instead of touching 200k object headers.

// A plain const object rather than a TS `enum`: enums compile to runtime
// code that isn't erasable, which this project's tsconfig
// (erasableSyntaxOnly) disallows.
export const MsgType = {
  TEXT: 0,
  IMAGE: 1,
  VIDEO: 2,
  STICKER: 3,
  AUDIO: 4,
  DOCUMENT: 5,
  GIF: 6,
  CONTACT: 7,
  CALL: 8,
  DELETED: 9,
  SYSTEM: 10,
} as const;
export type MsgType = (typeof MsgType)[keyof typeof MsgType];

export const MSG_TYPE_NAME: Record<MsgType, string> = {
  0: "TEXT",
  1: "IMAGE",
  2: "VIDEO",
  3: "STICKER",
  4: "AUDIO",
  5: "DOCUMENT",
  6: "GIF",
  7: "CONTACT",
  8: "CALL",
  9: "DELETED",
  10: "SYSTEM",
};

export const MEDIA_TYPES = new Set<MsgType>([
  MsgType.IMAGE,
  MsgType.VIDEO,
  MsgType.STICKER,
  MsgType.AUDIO,
  MsgType.DOCUMENT,
  MsgType.GIF,
  MsgType.CONTACT,
]);

// Bit flags, packed into one Uint8Array so a whole 200k-message chat's
// flag column is ~200KB.
export const Flag = {
  EDITED: 1 << 0,
  MISSED: 1 << 1,
  // Text referenced media ("image omitted") but no file is available —
  // render a placeholder tile instead of trying to load anything.
  OMITTED: 1 << 2,
  // A real file was matched from the zip and is resolvable via mediaKey.
  HAS_FILE: 1 << 3,
} as const;

/** Sentinel senderId meaning "no sender" (centered system notices). */
export const NO_SENDER = 255;

export interface ChatModel {
  count: number;
  /** Epoch milliseconds, ascending (WhatsApp exports are already chronological). */
  ts: Float64Array;
  /** Index into `senders`, or NO_SENDER for system messages. */
  senderId: Uint8Array;
  type: Uint8Array; // MsgType
  flags: Uint8Array; // Flag bitmask
  /** Text content / caption. Never contains the raw media-omitted token. */
  bodies: string[];
  /** Filename to resolve in the media blob store, when Flag.HAS_FILE is set. */
  mediaKey: (string | null)[];
  /** Display names in order of first appearance. senders.length <= 255. */
  senders: string[];
  /** 'DMY' or 'MDY' — how ambiguous two-digit date pairs were interpreted. */
  dateOrder: "DMY" | "MDY";
  /** True if the date order was inferred with certainty (some day/month > 12 seen). */
  dateOrderCertain: boolean;
}

export function emptyModel(): ChatModel {
  return {
    count: 0,
    ts: new Float64Array(0),
    senderId: new Uint8Array(0),
    type: new Uint8Array(0),
    flags: new Uint8Array(0),
    bodies: [],
    mediaKey: [],
    senders: [],
    dateOrder: "DMY",
    dateOrderCertain: false,
  };
}

/** Builder used during parsing: plain arrays (fast to push to), converted
 * to typed arrays once at the end via `finish()`. */
export class ChatModelBuilder {
  private ts: number[] = [];
  private senderId: number[] = [];
  private type: number[] = [];
  private flags: number[] = [];
  bodies: string[] = [];
  mediaKey: (string | null)[] = [];
  senders: string[] = [];
  private senderIndex = new Map<string, number>();

  senderIdFor(name: string): number {
    let id = this.senderIndex.get(name);
    if (id === undefined) {
      if (this.senders.length >= 255) {
        // Absurd number of distinct senders (probably a parse error) —
        // collapse the overflow into the last slot rather than overflow
        // the Uint8Array's range.
        return 254;
      }
      id = this.senders.length;
      this.senders.push(name);
      this.senderIndex.set(name, id);
    }
    return id;
  }

  push(
    tsMs: number,
    senderId: number,
    type: MsgType,
    flags: number,
    body: string,
    mediaKey: string | null = null,
  ) {
    this.ts.push(tsMs);
    this.senderId.push(senderId);
    this.type.push(type);
    this.flags.push(flags);
    this.bodies.push(body);
    this.mediaKey.push(mediaKey);
  }

  get length() {
    return this.ts.length;
  }

  finish(dateOrder: "DMY" | "MDY", dateOrderCertain: boolean): ChatModel {
    return {
      count: this.ts.length,
      ts: Float64Array.from(this.ts),
      senderId: Uint8Array.from(this.senderId),
      type: Uint8Array.from(this.type),
      flags: Uint8Array.from(this.flags),
      bodies: this.bodies,
      mediaKey: this.mediaKey,
      senders: this.senders,
      dateOrder,
      dateOrderCertain,
    };
  }
}
