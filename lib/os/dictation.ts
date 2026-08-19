/**
 * The dictation bus — the ONLY coupling point between WhisperFlow and Notes.
 *
 * COORDINATOR-OWNED. WhisperFlow writes; Notes reads. Neither imports the other,
 * which is what keeps two independently-owned apps from growing a hard
 * dependency on each other's internals.
 *
 * Why a store rather than useAppSession: a dictated line has to appear in an
 * ALREADY-OPEN Notes window, live, mid-sentence. useAppSession hydrates once on
 * mount (lib/os/persist.ts), so a window that is already on screen would never
 * see the write. Notes still persists its document the normal way — this store
 * only carries the delta.
 *
 * Usage — producer (WhisperFlow):
 *   useDictationStore.getState().emit('the transcribed sentence');
 *
 * Usage — consumer (Notes):
 *   const last = useDictationStore((s) => s.last);
 *   useEffect(() => { if (last) append(last.text); }, [last]);
 *
 * `last` is a new object on every emit, so two identical sentences dictated in
 * a row still register as two separate events. Comparing on text alone would
 * silently swallow the second one.
 */
import { create } from 'zustand';

/** Where a transcript came from. Surfaced in the UI so demo text is never passed off as real. */
export type DictationSource = 'live' | 'demo';

export interface DictationEvent {
  /** The transcribed text, already trimmed. Never empty. */
  text: string;
  /** Monotonic id — makes repeat sentences distinguishable. */
  id: number;
  source: DictationSource;
  at: number;
}

export interface DictationStore {
  /** The most recent utterance, or null if nothing has been dictated this session. */
  last: DictationEvent | null;
  /** Everything dictated this session, newest last. Drives WhisperFlow's history panel. */
  history: DictationEvent[];
  /**
   * True while a consumer (Notes) is mounted and listening. WhisperFlow reads
   * this to tell the user where their words are about to land.
   */
  sinkReady: boolean;

  emit: (text: string, source?: DictationSource) => void;
  clearHistory: () => void;
  setSinkReady: (ready: boolean) => void;
}

/** How many utterances to keep. The panel is small and this is a session log, not an archive. */
const MAX_HISTORY = 50;

let counter = 0;

export const useDictationStore = create<DictationStore>((set) => ({
  last: null,
  history: [],
  sinkReady: false,

  emit: (text, source = 'live') => {
    const trimmed = text.trim();
    // An empty transcript is a normal outcome — silence, or a failed request
    // that fell back to nothing. Dropping it here means no consumer has to.
    if (!trimmed) return;
    counter += 1;
    const event: DictationEvent = { text: trimmed, id: counter, source, at: Date.now() };
    set((state) => ({
      last: event,
      history: [...state.history, event].slice(-MAX_HISTORY),
    }));
  },

  clearHistory: () => set({ history: [], last: null }),

  setSinkReady: (ready) => set({ sinkReady: ready }),
}));
