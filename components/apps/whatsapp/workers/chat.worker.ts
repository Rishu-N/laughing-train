// The worker entry point. All it does is bolt createChatHandler() onto the
// worker scope — the actual unzip/parse/merge/search lives in handler.ts so the
// main-thread fallback in client.ts runs the identical code.
//
// Typed against a minimal hand-rolled worker-scope interface rather than
// lib.webworker.d.ts: the project's tsconfig only loads the DOM lib (for
// React), and DOM + WebWorker declare conflicting globals (`self` chief among
// them) when both are loaded in one TS program.
import { createChatHandler } from "./handler";
import type { WorkerRequest, WorkerResponse } from "./protocol";

interface WorkerScope {
  postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
  onmessage: ((ev: MessageEvent<WorkerRequest>) => void) | null;
}

const ctx = self as unknown as WorkerScope;
const handle = createChatHandler();

ctx.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  handle(ev.data, (msg, transfer) => ctx.postMessage(msg, transfer ?? []));
};
