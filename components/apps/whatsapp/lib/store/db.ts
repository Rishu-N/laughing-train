// Persistence for the "list of zips we've opened" history. Deliberately
// stores the raw `_chat.txt` string, not the parsed columnar model:
// re-parsing on open (milliseconds, even at 200k messages, since it's a
// single linear pass) is cheaper than structured-cloning a large typed
// array in and out of IndexedDB, and keeps each record small.
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

const DB_NAME = "whatsapp-simulator";
const DB_VERSION = 1;

export interface ChatRecord {
  id: string;
  /** Display name — derived from the zip filename, user-editable. */
  name: string;
  /** One entry per merged export. A normal import has exactly one; a
   * chat stitched from several exports (or extended later with "merge
   * another export in") has more. Reopening re-parses and re-merges all
   * of them — the merge algorithm only has to live in one place. */
  rawTexts: string[];
  createdAt: number;
  lastOpenedAt: number;
  messageCount: number;
  senders: string[];
  firstTs: number;
  lastTs: number;
  lastPreview: string;
  /** Index into `senders` chosen as "me" (right-aligned, green). */
  meId: number;
  dateOrderOverride?: "DMY" | "MDY";
}

interface MediaRecord {
  key: string; // `${chatId}::${filename}`
  chatId: string;
  filename: string;
  blob: Blob;
}

interface Schema extends DBSchema {
  chats: { key: string; value: ChatRecord };
  media: { key: string; value: MediaRecord; indexes: { byChatId: string } };
}

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<Schema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("chats")) {
          db.createObjectStore("chats", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("media")) {
          const store = db.createObjectStore("media", { keyPath: "key" });
          store.createIndex("byChatId", "chatId");
        }
      },
    });
    // A transient failure (blocked upgrade, private-browsing storage
    // limits) would otherwise wedge every future call behind the same
    // rejected promise for the rest of the tab session.
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

/** Reads `rawTexts`, tolerating records saved before this field existed
 * (which had a single `rawText: string` instead). */
function readRawTexts(rec: ChatRecord & { rawText?: string }): string[] {
  if (Array.isArray(rec.rawTexts)) return rec.rawTexts.filter((t) => typeof t === "string");
  return typeof rec.rawText === "string" && rec.rawText ? [rec.rawText] : [];
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/**
 * Coerces whatever actually came out of IndexedDB into a record the UI can
 * render.
 *
 * The store is not a fresh database every visit — it holds records written by
 * older builds, and records whose write was interrupted by a closed tab
 * mid-transaction. There is no error boundary between a row in the chat list
 * and the whole operating system, so a single missing `messageCount` would
 * throw inside `toLocaleString()` during render and take the desktop down with
 * it — permanently, since the same record is read again on every reload. That
 * failure mode is why every field is defaulted here rather than at each of the
 * dozen places that reads one.
 */
function normalize(rec: unknown): ChatRecord | null {
  if (!rec || typeof rec !== "object") return null;
  const r = rec as ChatRecord & { rawText?: string };
  if (typeof r.id !== "string" || r.id === "") return null;
  const now = Date.now();
  return {
    id: r.id,
    name: typeof r.name === "string" && r.name ? r.name : "Untitled chat",
    rawTexts: readRawTexts(r),
    createdAt: num(r.createdAt, now),
    lastOpenedAt: num(r.lastOpenedAt, num(r.createdAt, now)),
    messageCount: num(r.messageCount, 0),
    senders: Array.isArray(r.senders) ? r.senders.filter((s) => typeof s === "string") : [],
    firstTs: num(r.firstTs, 0),
    lastTs: num(r.lastTs, 0),
    lastPreview: typeof r.lastPreview === "string" ? r.lastPreview : "",
    meId: num(r.meId, 0),
    dateOrderOverride: r.dateOrderOverride === "DMY" || r.dateOrderOverride === "MDY" ? r.dateOrderOverride : undefined,
  };
}

export async function saveChat(chat: ChatRecord): Promise<void> {
  const db = await getDb();
  await db.put("chats", chat);
}

export async function listChats(): Promise<ChatRecord[]> {
  const db = await getDb();
  const all = await db.getAll("chats");
  // A record too broken to have an id is dropped rather than repaired —
  // there is nothing to open it by, so showing it would only offer the
  // visitor a row that does nothing.
  return all
    .map(normalize)
    .filter((r): r is ChatRecord => r !== null)
    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}

export async function getChat(id: string): Promise<ChatRecord | undefined> {
  const db = await getDb();
  return normalize(await db.get("chats", id)) ?? undefined;
}

export async function touchChat(id: string): Promise<void> {
  const db = await getDb();
  const rec = await db.get("chats", id);
  if (!rec) return;
  rec.lastOpenedAt = Date.now();
  await db.put("chats", rec);
}

export async function renameChat(id: string, name: string): Promise<void> {
  const db = await getDb();
  const rec = await db.get("chats", id);
  if (!rec) return;
  rec.name = name;
  await db.put("chats", rec);
}

export async function setMeId(id: string, meId: number): Promise<void> {
  const db = await getDb();
  const rec = await db.get("chats", id);
  if (!rec) return;
  rec.meId = meId;
  await db.put("chats", rec);
}

export async function setDateOrderOverride(
  id: string,
  order: "DMY" | "MDY" | undefined,
): Promise<void> {
  const db = await getDb();
  const rec = await db.get("chats", id);
  if (!rec) return;
  rec.dateOrderOverride = order;
  await db.put("chats", rec);
}

export async function updateChatMeta(
  id: string,
  patch: Partial<Pick<ChatRecord, "messageCount" | "senders" | "firstTs" | "lastTs" | "lastPreview">>,
): Promise<void> {
  const db = await getDb();
  const rec = await db.get("chats", id);
  if (!rec) return;
  Object.assign(rec, patch);
  await db.put("chats", rec);
}

export async function deleteChat(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["chats", "media"], "readwrite");
  await tx.objectStore("chats").delete(id);
  const mediaIndex = tx.objectStore("media").index("byChatId");
  let cursor = await mediaIndex.openCursor(IDBKeyRange.only(id));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function saveMediaBlobs(chatId: string, blobs: Map<string, Blob>): Promise<void> {
  if (blobs.size === 0) return;
  const db = await getDb();
  const tx = db.transaction("media", "readwrite");
  const store = tx.objectStore("media");
  for (const [filename, blob] of blobs) {
    await store.put({ key: `${chatId}::${filename}`, chatId, filename, blob });
  }
  await tx.done;
}

export async function getMediaBlob(chatId: string, filename: string): Promise<Blob | undefined> {
  const db = await getDb();
  const rec = await db.get("media", `${chatId}::${filename}`);
  return rec?.blob;
}

export async function getAllMediaForChat(chatId: string): Promise<Map<string, Blob>> {
  const db = await getDb();
  const recs = await db.getAllFromIndex("media", "byChatId", chatId);
  const out = new Map<string, Blob>();
  for (const r of recs) out.set(r.filename, r.blob);
  return out;
}
