// Typed Promise wrapper around chat.worker.ts's postMessage protocol.
// A single instance is shared for the life of the window.
//
// ── WHY THERE IS A FALLBACK ────────────────────────────────────────────────
// The worker is the point: a 200k-message export takes real time to unzip and
// parse, and doing it on the main thread would freeze the whole OS, not just
// this window. So the worker is always tried first.
//
// But a worker is also the one part of this app that depends on the bundler
// getting `new Worker(new URL(...), { type: 'module' })` right, and a worker
// that fails to load never posts a message — every request would simply hang.
// Rather than leave the app dead in that case, a failure (construction throws,
// or onerror fires before anything comes back) permanently degrades this
// client to running handler.ts on the main thread. Same code, same protocol,
// same promises; the only difference is that a very large import would block.
// A frozen tab beats a blank window.
import { createChatHandler } from "./handler";
import type {
  MergeSource,
  MergeSourcesDone,
  Progress,
  WorkerRequest,
  WorkerResponse,
} from "./protocol";

type Pending = {
  request: WorkerRequest;
  resolve: (v: never) => void;
  reject: (e: unknown) => void;
  onProgress?: (p: Progress) => void;
};

class ChatWorkerClient {
  private worker: Worker | null = null;
  private local: ReturnType<typeof createChatHandler> | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  /** Set once the worker has answered anything at all. Until then its zip
   * buffers are cloned rather than transferred: a transfer detaches them, and
   * a detached buffer cannot be replayed on the main thread if it turns out
   * the worker never loaded. One extra memcpy on the first import buys a
   * fallback that always works. */
  private proven = false;

  constructor() {
    try {
      this.worker = new Worker(new URL("./chat.worker.ts", import.meta.url), {
        type: "module",
      });
      this.worker.onmessage = (ev: MessageEvent<WorkerResponse>) => this.handle(ev.data);
      // A worker script failing to load/evaluate (bad chunk after a redeploy,
      // a CSP block, a bundler that didn't emit it) never posts a message at
      // all — without this, every pending request would hang forever.
      this.worker.onerror = (ev: ErrorEvent) => {
        this.degrade(ev.message || "Worker failed to load");
      };
    } catch (err) {
      this.degrade(err instanceof Error ? err.message : String(err));
    }
  }

  /** True once the worker has been given up on. Surfaced for diagnostics. */
  get onMainThread(): boolean {
    return this.local !== null;
  }

  private degrade(reason: string) {
    if (this.local) return;
    console.warn(
      `[whatsapp] Web Worker unavailable (${reason}) — parsing on the main thread instead.`,
    );
    this.worker?.terminate();
    this.worker = null;
    this.local = createChatHandler();
    // Anything already in flight was posted to a worker that will never
    // answer. Replay it locally so the visitor's import still completes.
    const replay = [...this.pending.values()];
    this.pending.clear();
    for (const p of replay) {
      this.pending.set(p.request.id, p);
      this.runLocally(p.request);
    }
  }

  private runLocally(request: WorkerRequest) {
    // Off the current task so callers always observe an async boundary,
    // whichever path a request took.
    setTimeout(() => this.local?.(request, (msg) => this.handle(msg)), 0);
  }

  private handle(msg: WorkerResponse) {
    if (this.worker) this.proven = true;
    if (msg.type === "progress") {
      this.pending.get(msg.id)?.onProgress?.(msg);
      return;
    }
    const p = this.pending.get(msg.id);
    if (!p) return;
    this.pending.delete(msg.id);
    if (msg.type === "error") p.reject(new Error(msg.message));
    else p.resolve(msg as never);
  }

  private send<T>(request: WorkerRequest, transfer: Transferable[], onProgress?: (p: Progress) => void) {
    return new Promise<T>((resolve, reject) => {
      this.pending.set(request.id, {
        request,
        resolve: resolve as never,
        reject,
        onProgress,
      });
      if (this.worker) this.worker.postMessage(request, transfer);
      else this.runLocally(request);
    });
  }

  /** One entry point for every import/reopen/merge shape — see
   * MergeSource in protocol.ts. Every ZipSource's `buffer` is transferred
   * rather than copied when a real worker is in play. */
  mergeSources(
    chatId: string,
    sources: MergeSource[],
    dateOrder?: "DMY" | "MDY",
    onProgress?: (p: Progress) => void,
  ): Promise<MergeSourcesDone> {
    const id = this.nextId++;
    const request: WorkerRequest = { type: "mergeSources", id, chatId, sources, dateOrder };
    const transfer =
      this.worker && this.proven
        ? sources
            .filter((s): s is MergeSource & { kind: "zip" } => s.kind === "zip")
            .map((s) => s.buffer)
        : [];
    return this.send<MergeSourcesDone>(request, transfer, onProgress);
  }

  async search(chatId: string, query: string): Promise<Uint32Array> {
    const id = this.nextId++;
    const msg = await this.send<WorkerResponse & { type: "search:done" }>(
      { type: "search", id, chatId, query },
      [],
    );
    return msg.indices;
  }

  terminate() {
    // Any request still in flight would otherwise hang forever — the
    // worker is gone and can never post a response for it.
    const err = new Error("Worker terminated");
    for (const [, p] of this.pending) p.reject(err);
    this.pending.clear();
    this.worker?.terminate();
  }
}

let singleton: ChatWorkerClient | null = null;

export function getChatWorker(): ChatWorkerClient {
  if (!singleton) singleton = new ChatWorkerClient();
  return singleton;
}

export type { ChatWorkerClient };
