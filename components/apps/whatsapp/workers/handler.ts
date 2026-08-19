// Unzip + parse + merge + search, with no idea where it is running.
//
// This used to be the body of chat.worker.ts. It was pulled out so the exact
// same code can run on the main thread when a Worker cannot be constructed —
// see client.ts. Two copies of the parse pipeline would be two places for a
// format bug to hide, so there is one, called from two places.
//
// The only state kept across requests is a per-chat lowercased-body index for
// search. Everything else (the parsed model, media blobs) is handed straight
// back to the caller and not retained, so memory does not grow with chat
// history the visitor is not currently searching.
import { unzipSync } from "fflate";
import { parseChat, detectDateOrder } from "../lib/parse/whatsapp";
import { resolveMedia } from "../lib/parse/media";
import { deriveContactName, guessMeId } from "../lib/parse/identity";
import { mergeModels } from "../lib/parse/merge";
import type { ChatModel } from "../lib/model";
import type { MergeSource, WorkerRequest, WorkerResponse } from "./protocol";

/** How a handler hands results back. In the worker this is postMessage; on the
 * main thread it is a plain callback. The transfer list is ignored there. */
export type Post = (msg: WorkerResponse, transfer?: Transferable[]) => void;

function findChatEntry(files: Record<string, Uint8Array>): [string, Uint8Array] | null {
  const names = Object.keys(files);
  const exact = names.find((n) => /(^|\/)_chat\.txt$/i.test(n));
  if (exact) return [exact, files[exact]];
  const anyTxt = names.find((n) => /\.txt$/i.test(n));
  if (anyTxt) return [anyTxt, files[anyTxt]];
  return null;
}

interface ResolvedSource {
  rawText: string;
  mediaFiles: Map<string, Uint8Array> | null; // null for a TextSource — nothing new to resolve
  zipFilename: string | null;
}

function resolveSource(src: MergeSource): ResolvedSource {
  if (src.kind === "text") {
    return { rawText: src.text, mediaFiles: null, zipFilename: null };
  }
  const files = unzipSync(new Uint8Array(src.buffer));
  const chatEntry = findChatEntry(files);
  if (!chatEntry) {
    throw new Error(`No _chat.txt found inside ${src.filename} — is it a WhatsApp chat export?`);
  }
  const [chatFileName, chatBytes] = chatEntry;
  const rawText = new TextDecoder("utf-8").decode(chatBytes);
  const mediaFiles = new Map<string, Uint8Array>();
  for (const [name, bytes] of Object.entries(files)) {
    if (name === chatFileName) continue;
    mediaFiles.set(name, bytes);
  }
  return { rawText, mediaFiles, zipFilename: src.filename };
}

/** One handler owns one search index; the worker and the fallback each make
 * their own, which is correct — they never both serve the same session. */
export function createChatHandler() {
  const searchIndex = new Map<string, string[]>(); // chatId -> lowercased bodies

  return function handle(req: WorkerRequest, post: Post): void {
    try {
      if (req.type === "mergeSources") {
        post({ type: "progress", id: req.id, phase: "unzip", done: 0, total: 1 });
        const resolved = req.sources.map(resolveSource);

        // Detect date order once across every source's lines combined, so
        // sources parsed independently can't disagree and corrupt the
        // merged chronological order.
        let dateOrder = req.dateOrder;
        if (!dateOrder) {
          if (resolved.length > 1) {
            const allLines = resolved.flatMap((r) => r.rawText.split(/\r\n|\n/));
            dateOrder = detectDateOrder(allLines).order;
          }
          // A single source keeps parseChat's own per-file detection
          // (dateOrder left undefined below).
        }

        const models: ChatModel[] = [];
        const mediaBlobs = new Map<string, Blob>();
        let firstZipFilename: string | null = null;
        const total = resolved.length;
        for (let i = 0; i < resolved.length; i++) {
          const r = resolved[i];
          const model = parseChat(r.rawText, {
            dateOrder,
            onProgress:
              resolved.length === 1
                ? (done, lineTotal) =>
                    post({ type: "progress", id: req.id, phase: "parse", done, total: lineTotal })
                : undefined,
          });
          if (r.mediaFiles) {
            const resolvedBlobs = resolveMedia(model, r.mediaFiles);
            for (const [k, v] of resolvedBlobs) mediaBlobs.set(k, v);
            if (firstZipFilename === null) firstZipFilename = r.zipFilename;
          }
          models.push(model);
          post({ type: "progress", id: req.id, phase: "parse", done: i + 1, total });
        }

        const { model, stats } = mergeModels(models);

        let contactName: string | null = null;
        let meId: number | null = null;
        if (firstZipFilename) {
          contactName = deriveContactName(firstZipFilename);
          meId = guessMeId(model.senders, contactName);
        }

        searchIndex.set(
          req.chatId,
          model.bodies.map((b) => b.toLowerCase()),
        );

        post({
          type: "mergeSources:done",
          id: req.id,
          chatId: req.chatId,
          model,
          mediaBlobs,
          contactName,
          meId,
          rawTexts: resolved.map((r) => r.rawText),
          stats,
        });
        return;
      }

      if (req.type === "search") {
        const bodies = searchIndex.get(req.chatId) ?? [];
        const q = req.query.toLowerCase();
        const hits: number[] = [];
        if (q.length > 0) {
          for (let i = 0; i < bodies.length; i++) {
            if (bodies[i].includes(q)) hits.push(i);
          }
        }
        const indices = Uint32Array.from(hits);
        post({ type: "search:done", id: req.id, indices }, [indices.buffer]);
        return;
      }
    } catch (err) {
      post({ type: "error", id: req.id, message: err instanceof Error ? err.message : String(err) });
    }
  };
}
