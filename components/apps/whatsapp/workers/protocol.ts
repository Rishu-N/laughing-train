// Message protocol between the main thread and chat.worker.ts. Everything
// heavy — unzip, parse, merge, search — happens in the worker so the UI
// thread never blocks, even on a 200k-message import.
import type { ChatModel } from "../lib/model";
import type { MergeStats } from "../lib/parse/merge";

/** A raw zip file's bytes, not yet unzipped. */
export interface ZipSource {
  kind: "zip";
  buffer: ArrayBuffer;
  /** The original .zip filename — used to derive "who is the contact". */
  filename: string;
}

/** A previously-imported chat's raw `_chat.txt`, already sitting in
 * IndexedDB — no unzip or media resolution needed, its media is already
 * stored from whenever it was first imported. */
export interface TextSource {
  kind: "text";
  text: string;
}

export type MergeSource = ZipSource | TextSource;

// One request type covers every case the app needs:
//  - fresh single-zip import        → sources: [ZipSource]
//  - reopening a normal chat        → sources: [TextSource]
//  - reopening a merged chat        → sources: [TextSource, TextSource, ...]
//  - stitching a fresh multi-zip    → sources: [ZipSource, ZipSource, ...]
//  - adding a new export to history → sources: [...existing TextSources, new ZipSource]
// A single source is a no-op "merge" — one code path, no special-casing.
export type WorkerRequest =
  | {
      type: "mergeSources";
      id: number;
      chatId: string;
      sources: MergeSource[];
      dateOrder?: "DMY" | "MDY";
    }
  | { type: "search"; id: number; chatId: string; query: string };

export interface MergeSourcesDone {
  type: "mergeSources:done";
  id: number;
  chatId: string;
  model: ChatModel;
  /** Newly resolved media from any ZipSource in this call. Empty if every
   * source was a TextSource (its media already lives in IndexedDB). */
  mediaBlobs: Map<string, Blob>;
  /** Derived from the first ZipSource's filename, if any was provided. */
  contactName: string | null;
  /** Guessed only when a contactName could be derived; the caller decides
   * whether to apply it (fresh import: yes; adding to existing chat: no,
   * keep the chat's current choice). */
  meId: number | null;
  /** Each source's raw chat text, in the order given — the caller persists
   * this as the chat's new source list. */
  rawTexts: string[];
  stats: MergeStats;
}

export interface SearchDone {
  type: "search:done";
  id: number;
  indices: Uint32Array;
}

export interface Progress {
  type: "progress";
  id: number;
  phase: "unzip" | "parse";
  done: number;
  total: number;
}

export interface WorkerError {
  type: "error";
  id: number;
  message: string;
}

export type WorkerResponse = MergeSourcesDone | SearchDone | Progress | WorkerError;
