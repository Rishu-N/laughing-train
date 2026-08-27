'use client';

// Single app-wide context: chat history, the active chat's parsed model,
// the active date/time filter, search state, and the actions that touch
// IndexedDB or the worker. Kept as one context (rather than several) —
// the component tree below it is shallow (Sidebar, SettingsPanel,
// ChatView, SearchBar), so selector-less re-renders aren't a cost here;
// the actual scale problem (hundreds of thousands of messages) is solved
// inside ChatView's virtualization, not by fine-grained context slicing.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAppSession } from "@/lib/os/persist";
import type { MockConversation } from "@/content/conversations";
import { emptyModel, type ChatModel } from "../lib/model";
import * as db from "../lib/store/db";
import type { ChatRecord } from "../lib/store/db";
import { sampleChatId, sampleZipName, sampleZipUrl } from "../lib/samples";
import { getChatWorker } from "../workers/client";
import type { MergeSource, Progress } from "../workers/protocol";
import type { MergeStats } from "../lib/parse/merge";
import { selectRange, clipSortedToRange, type Range } from "../lib/select";

export interface RangeFilter {
  startMs: number | null;
  endMs: number | null;
}

export interface UiSettings {
  theme: "light" | "dark";
  showTimestamps: boolean;
  showSystem: boolean;
}

const DEFAULT_SETTINGS: UiSettings = {
  theme: "light",
  showTimestamps: true,
  showSystem: true,
};

export interface SearchState {
  query: string;
  hits: Uint32Array;
  activeHit: number;
}

const EMPTY_SEARCH: SearchState = { query: "", hits: new Uint32Array(0), activeHit: -1 };

export interface ImportProgressState {
  phase: "unzip" | "parse";
  done: number;
  total: number;
}

interface Ctx {
  chats: ChatRecord[];
  activeChatId: string | null;
  activeRecord: ChatRecord | null;
  model: ChatModel;
  mediaBlobs: Map<string, Blob>;
  meId: number;
  range: RangeFilter;
  visibleRange: Range;
  settings: UiSettings;
  search: SearchState;
  importProgress: ImportProgressState | null;
  importError: string | null;
  mergeStats: MergeStats | null;
  settingsPanelOpen: boolean;

  /** Imports one or more .zip files. More than one is treated as several
   * exports of the *same* conversation and stitched into one chat —
   * deduplicated and sorted by timestamp, not concatenated. */
  importZipFiles: (files: File[]) => Promise<void>;
  /**
   * Fetches one of the sample exports out of /downloads and imports it, or
   * reopens it if it is already in history. Same-origin, so the offline
   * guarantee holds — see tests/offline.spec.ts.
   */
  loadSample: (conversation: MockConversation) => Promise<void>;
  /** Adds one more export to an already-imported chat's history — for
   * when you export again later and want the new range folded in rather
   * than creating a second, separate chat. */
  mergeMoreIntoChat: (chatId: string, files: File[]) => Promise<void>;
  openChat: (id: string) => Promise<void>;
  deleteChatById: (id: string) => Promise<void>;
  renameChatById: (id: string, name: string) => Promise<void>;
  setMeId: (meId: number) => void;
  setDateOrderOverride: (order: "DMY" | "MDY" | undefined) => Promise<void>;
  setRange: (range: RangeFilter) => void;
  clearRange: () => void;
  setSettings: (patch: Partial<UiSettings>) => void;
  runSearch: (query: string) => void;
  nextHit: () => void;
  prevHit: () => void;
  clearSearch: () => void;
  toggleSettingsPanel: () => void;
  dismissImportError: () => void;
  dismissMergeStats: () => void;
}

const AppContext = createContext<Ctx | null>(null);

function previewFor(model: ChatModel): string {
  for (let i = model.count - 1; i >= 0; i--) {
    const b = model.bodies[i];
    if (b) return b.length > 80 ? b.slice(0, 80) + "…" : b;
  }
  return "";
}

function metaFromModel(model: ChatModel) {
  return {
    messageCount: model.count,
    senders: model.senders,
    firstTs: model.count > 0 ? model.ts[0] : 0,
    lastTs: model.count > 0 ? model.ts[model.count - 1] : 0,
    lastPreview: previewFor(model),
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [chats, setChats] = useState<ChatRecord[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeRecord, setActiveRecord] = useState<ChatRecord | null>(null);
  const [model, setModel] = useState<ChatModel>(() => emptyModel());
  const [mediaBlobs, setMediaBlobs] = useState<Map<string, Blob>>(new Map());
  const [range, setRangeState] = useState<RangeFilter>({ startMs: null, endMs: null });
  // The OS owns persistence (namespaced, debounced, SSR-safe). The standalone
  // build read localStorage in a useState initialiser; doing that here would be
  // a hydration mismatch waiting to happen.
  const [settings, setSettingsState] = useAppSession<UiSettings>(
    "whatsapp:settings",
    DEFAULT_SETTINGS,
  );
  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH);
  const [importProgress, setImportProgress] = useState<ImportProgressState | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [mergeStats, setMergeStats] = useState<MergeStats | null>(null);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);

  // "I am..." is just activeRecord.meId — kept as one source of truth
  // instead of a separately-tracked useState, so there's nothing to
  // forget to reset when the active chat changes or is deleted.
  const meId = activeRecord?.meId ?? 0;

  // Guards against a slower, earlier request (e.g. clicking chat A then
  // quickly clicking chat B) applying its result after a newer one has
  // already taken over — whichever call is current when a result comes
  // back wins, not whichever happens to finish last.
  const requestGen = useRef(0);
  const activeChatIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    // Storage can be unavailable outright — a blocked upgrade, a private
    // window with no quota. An empty history is still a usable app; an
    // unhandled rejection on mount is just a silent one.
    db.listChats()
      .then(setChats)
      .catch((err) => setImportError(err instanceof Error ? err.message : String(err)));
  }, []);

  // The theme used to be written onto <html>. Inside the OS that would repaint
  // the whole desktop, so the app's own wrapper carries data-theme instead —
  // see WhatsAppApp.tsx and the scoping note at the top of whatsapp.css.

  const activate = useCallback((chatId: string, rec: ChatRecord, m: ChatModel, blobs: Map<string, Blob>) => {
    setActiveChatId(chatId);
    setActiveRecord(rec);
    setModel(m);
    setMediaBlobs(blobs);
    setRangeState({ startMs: null, endMs: null });
    setSearch(EMPTY_SEARCH);
  }, []);

  /**
   * The one import path. A dropped file and a fetched sample differ only in
   * where their bytes came from, so both arrive here as {filename, buffer} —
   * the filename still matters because it is what identifies the contact.
   *
   * `chatId` is caller-supplied so samples can use a stable id and be reopened
   * rather than re-imported into a second copy every time the folder is
   * double-clicked.
   */
  const importZipBuffers = useCallback(
    async (zips: { filename: string; buffer: ArrayBuffer }[], chatId: string) => {
      if (zips.length === 0) return;
      setImportError(null);
      setMergeStats(null);
      const gen = ++requestGen.current;
      const worker = getChatWorker();
      try {
        setImportProgress({ phase: "unzip", done: 0, total: zips.length });
        const sources: MergeSource[] = zips.map((z) => ({
          kind: "zip" as const,
          buffer: z.buffer,
          filename: z.filename,
        }));
        const result = await worker.mergeSources(chatId, sources, undefined, (p: Progress) =>
          setImportProgress({ phase: p.phase, done: p.done, total: p.total }),
        );
        const name = result.contactName ?? zips[0].filename.replace(/\.zip$/i, "");
        const rec: ChatRecord = {
          id: chatId,
          name,
          rawTexts: result.rawTexts,
          createdAt: Date.now(),
          lastOpenedAt: Date.now(),
          meId: result.meId ?? 0,
          ...metaFromModel(result.model),
        };
        await db.saveChat(rec);
        await db.saveMediaBlobs(chatId, result.mediaBlobs);
        setChats(await db.listChats());
        if (gen === requestGen.current) {
          activate(chatId, rec, result.model, result.mediaBlobs);
          if (zips.length > 1) setMergeStats(result.stats);
        }
      } catch (err) {
        setImportError(err instanceof Error ? err.message : String(err));
      } finally {
        setImportProgress(null);
      }
    },
    [activate],
  );

  const importZipFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const zips = await Promise.all(
        files.map(async (f) => ({ filename: f.name, buffer: await f.arrayBuffer() })),
      );
      await importZipBuffers(zips, crypto.randomUUID());
    },
    [importZipBuffers],
  );

  const mergeMoreIntoChat = useCallback(
    async (chatId: string, files: File[]) => {
      if (files.length === 0) return;
      setImportError(null);
      setMergeStats(null);
      const gen = ++requestGen.current;
      try {
        const existing = await db.getChat(chatId);
        if (!existing) {
          setImportError("That chat is no longer in your history.");
          return;
        }
        setImportProgress({ phase: "unzip", done: 0, total: files.length });
        const newSources: MergeSource[] = await Promise.all(
          files.map(async (f) => ({ kind: "zip" as const, buffer: await f.arrayBuffer(), filename: f.name })),
        );
        const sources: MergeSource[] = [
          ...existing.rawTexts.map((text): MergeSource => ({ kind: "text", text })),
          ...newSources,
        ];
        const worker = getChatWorker();
        const result = await worker.mergeSources(chatId, sources, existing.dateOrderOverride, (p: Progress) =>
          setImportProgress({ phase: p.phase, done: p.done, total: p.total }),
        );
        const rec: ChatRecord = {
          ...existing,
          rawTexts: result.rawTexts,
          lastOpenedAt: Date.now(),
          ...metaFromModel(result.model),
        };
        await db.saveChat(rec);
        await db.saveMediaBlobs(chatId, result.mediaBlobs);
        setChats(await db.listChats());
        if (gen === requestGen.current) {
          activate(chatId, rec, result.model, result.mediaBlobs);
          setMergeStats(result.stats);
        }
      } catch (err) {
        setImportError(err instanceof Error ? err.message : String(err));
      } finally {
        setImportProgress(null);
      }
    },
    [activate],
  );

  const openChat = useCallback(
    async (id: string) => {
      if (id === activeChatId) return;
      const gen = ++requestGen.current;
      try {
        const rec = await db.getChat(id);
        if (!rec) {
          setImportError("That chat is no longer in your history.");
          return;
        }
        setImportProgress({ phase: "parse", done: 0, total: rec.rawTexts.length });
        const worker = getChatWorker();
        const sources: MergeSource[] = rec.rawTexts.map((text) => ({ kind: "text", text }));
        const [result, blobs] = await Promise.all([
          worker.mergeSources(id, sources, rec.dateOrderOverride, (p: Progress) =>
            setImportProgress({ phase: p.phase, done: p.done, total: p.total }),
          ),
          db.getAllMediaForChat(id),
        ]);
        await db.touchChat(id);
        setChats(await db.listChats());
        if (gen === requestGen.current) activate(id, rec, result.model, blobs);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : String(err));
      } finally {
        setImportProgress(null);
      }
    },
    [activeChatId, activate],
  );

  const loadSample = useCallback(
    async (conversation: MockConversation) => {
      const chatId = sampleChatId(conversation.id);
      try {
        // Already imported once — reopen it rather than parse the zip again,
        // and keep whatever the visitor changed (name, "I am…", date order).
        if (await db.getChat(chatId)) {
          await openChat(chatId);
          return;
        }
        setImportError(null);
        setImportProgress({ phase: "unzip", done: 0, total: 1 });
        const res = await fetch(sampleZipUrl(conversation.id));
        if (!res.ok) {
          throw new Error(
            `Couldn't load that sample (${res.status}). Run \`npm run samples\` to generate the .zip files.`,
          );
        }
        const buffer = await res.arrayBuffer();
        // The zip is stored under the conversation id so the Downloads folder
        // has a predictable URL, but the parser is handed the name WhatsApp
        // itself would have used — that filename is how "who is the contact,
        // and therefore who is me" gets decided (lib/parse/identity.ts).
        await importZipBuffers(
          [{ filename: sampleZipName(conversation), buffer }],
          chatId,
        );
      } catch (err) {
        setImportError(err instanceof Error ? err.message : String(err));
        setImportProgress(null);
      }
    },
    [importZipBuffers, openChat],
  );

  const deleteChatById = useCallback(
    async (id: string) => {
      try {
        await db.deleteChat(id);
        setChats(await db.listChats());
        if (id === activeChatId) {
          setActiveChatId(null);
          setActiveRecord(null);
          setModel(emptyModel());
          setMediaBlobs(new Map());
        }
      } catch (err) {
        setImportError(err instanceof Error ? err.message : String(err));
      }
    },
    [activeChatId],
  );

  const renameChatById = useCallback(async (id: string, name: string) => {
    try {
      await db.renameChat(id, name);
      setChats(await db.listChats());
      setActiveRecord((prev) => (prev && prev.id === id ? { ...prev, name } : prev));
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const setMeId = useCallback(
    (id: number) => {
      if (!activeChatId) return;
      setActiveRecord((prev) => (prev ? { ...prev, meId: id } : prev));
      db.setMeId(activeChatId, id).catch((err) => {
        setImportError(err instanceof Error ? err.message : String(err));
      });
    },
    [activeChatId],
  );

  const setDateOrderOverride = useCallback(
    async (order: "DMY" | "MDY" | undefined) => {
      if (!activeChatId || !activeRecord) return;
      try {
        setImportProgress({ phase: "parse", done: 0, total: activeRecord.rawTexts.length });
        const worker = getChatWorker();
        const sources: MergeSource[] = activeRecord.rawTexts.map((text) => ({ kind: "text", text }));
        const result = await worker.mergeSources(activeChatId, sources, order, (p: Progress) =>
          setImportProgress({ phase: p.phase, done: p.done, total: p.total }),
        );
        setModel(result.model);
        await db.setDateOrderOverride(activeChatId, order);
        setActiveRecord((prev) => (prev ? { ...prev, dateOrderOverride: order } : prev));
      } catch (err) {
        setImportError(err instanceof Error ? err.message : String(err));
      } finally {
        setImportProgress(null);
      }
    },
    [activeChatId, activeRecord],
  );

  const setRange = useCallback((r: RangeFilter) => setRangeState(r), []);
  const clearRange = useCallback(() => setRangeState({ startMs: null, endMs: null }), []);

  const setSettings = useCallback((patch: Partial<UiSettings>) => {
    setSettingsState((prev) => ({ ...prev, ...patch }));
  }, [setSettingsState]);

  const visibleRange = useMemo(
    () => selectRange(model, range.startMs ?? undefined, range.endMs ?? undefined),
    [model, range],
  );

  const runSearch = useCallback(
    (query: string) => {
      if (!activeChatId || query.trim() === "") {
        setSearch(EMPTY_SEARCH);
        return;
      }
      const worker = getChatWorker();
      const chatIdAtCallTime = activeChatId;
      worker.search(activeChatId, query).then((indices) => {
        // The active chat may have changed while this was in flight —
        // stale results shouldn't overwrite whatever's showing now.
        if (activeChatIdRef.current !== chatIdAtCallTime) return;
        // Search respects the active date/time filter — a hit outside
        // the visible range wouldn't be scrollable to anyway.
        const clipped = clipSortedToRange(indices, visibleRange.start, visibleRange.end);
        setSearch({ query, hits: clipped, activeHit: clipped.length > 0 ? 0 : -1 });
      });
    },
    [activeChatId, visibleRange],
  );

  // Re-run an active search whenever the date/time filter changes, so
  // hit count and navigation stay in sync without the user re-typing.
  //
  // This deliberately does not call runSearch(). That helper clears the search
  // synchronously when there is no active chat, and a synchronous setState in
  // an effect body cascades a second render on every filter nudge — the drag of
  // a date slider fires a lot of those. Driving the worker directly keeps every
  // setState inside the promise callback, where it belongs.
  const searchQueryRef = useRef(search.query);
  useEffect(() => {
    searchQueryRef.current = search.query;
  }, [search.query]);

  useEffect(() => {
    const query = searchQueryRef.current;
    if (!query || !activeChatId) return;
    const chatIdAtCallTime = activeChatId;
    let cancelled = false;
    getChatWorker()
      .search(activeChatId, query)
      .then((indices) => {
        // Same staleness guard as runSearch: the chat can change mid-flight,
        // and a later filter change can land before this resolves.
        if (cancelled || activeChatIdRef.current !== chatIdAtCallTime) return;
        const clipped = clipSortedToRange(indices, visibleRange.start, visibleRange.end);
        setSearch({ query, hits: clipped, activeHit: clipped.length > 0 ? 0 : -1 });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const nextHit = useCallback(() => {
    setSearch((s) => (s.hits.length === 0 ? s : { ...s, activeHit: (s.activeHit + 1) % s.hits.length }));
  }, []);
  const prevHit = useCallback(() => {
    setSearch((s) =>
      s.hits.length === 0 ? s : { ...s, activeHit: (s.activeHit - 1 + s.hits.length) % s.hits.length },
    );
  }, []);
  const clearSearch = useCallback(() => setSearch(EMPTY_SEARCH), []);

  const toggleSettingsPanel = useCallback(() => setSettingsPanelOpen((v) => !v), []);
  const dismissImportError = useCallback(() => setImportError(null), []);
  const dismissMergeStats = useCallback(() => setMergeStats(null), []);

  const value: Ctx = {
    chats,
    activeChatId,
    activeRecord,
    model,
    mediaBlobs,
    meId,
    range,
    visibleRange,
    settings,
    search,
    importProgress,
    importError,
    mergeStats,
    settingsPanelOpen,
    importZipFiles,
    loadSample,
    mergeMoreIntoChat,
    openChat,
    deleteChatById,
    renameChatById,
    setMeId,
    setDateOrderOverride,
    setRange,
    clearRange,
    setSettings,
    runSearch,
    nextHit,
    prevHit,
    clearSearch,
    toggleSettingsPanel,
    dismissImportError,
    dismissMergeStats,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
