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
  if (Array.isArray(rec.rawTexts)) return rec.rawTexts;
  return rec.rawText ? [rec.rawText] : [];
}

export async function saveChat(chat: ChatRecord): Promise<void> {
  const db = await getDb();
  await db.put("chats", chat);
}

export async function listChats(): Promise<ChatRecord[]> {
  const db = await getDb();
  const all = await db.getAll("chats");
  for (const rec of all) rec.rawTexts = readRawTexts(rec);
  return all.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}

export async function getChat(id: string): Promise<ChatRecord | undefined> {
  const db = await getDb();
  const rec = await db.get("chats", id);
  if (rec) rec.rawTexts = readRawTexts(rec);
  return rec;
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
