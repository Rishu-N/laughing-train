'use client';

/**
 * The dictation state machine — everything WhisperFlow does that isn't drawing.
 *
 * It mirrors the Mac app's `DictationState` (idle → recording → transcribing →
 * failed) minus the stages a browser cannot reach, and adds one the Mac app has
 * no need for: `typing`, the demo mode typewriter.
 *
 * Three rules shape this file:
 *
 *  1. The microphone only ever opens from an explicit press. There is no
 *     auto-start, no warm-up stream held open "just in case", and the stream's
 *     tracks are stopped the moment a take ends — including when it is
 *     cancelled. Nothing is recorded in the background: a tab going hidden ends
 *     the take rather than continuing it.
 *  2. Audio is never persisted. The Blob lives long enough to be uploaded and
 *     is then dropped; useAppSession stores settings only.
 *  3. Every failure is a named state with a sentence a person can act on.
 *     getUserMedia has half a dozen distinct rejections and they mean genuinely
 *     different things — "blocked in site settings" and "no microphone
 *     attached" need different advice, so they get different messages.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DictationSource } from '@/lib/os/dictation';
import {
  DEMO_RECORD_MS,
  DEMO_TRANSCRIBE_MS,
  DEMO_TRANSCRIPTS,
  DEMO_TYPE_MS,
  demoLevel,
} from './demoScript';

export type DictationMode = 'live' | 'demo';

/** Where the take is. `arming` is the gap while the permission prompt is up. */
export type DictationPhase =
  | 'idle'
  | 'arming'
  | 'recording'
  | 'transcribing'
  | 'typing'
  | 'failed';

/**
 * Microphone availability, as distinct from a transient failure.
 * `dismissed` is the case where the prompt was closed without an answer — the
 * browser will ask again, so it deserves different wording from `denied`.
 */
export type MicState =
  | 'unknown'
  | 'granted'
  | 'denied'
  | 'dismissed'
  | 'missing'
  | 'busy'
  | 'unsupported';

export interface WhisperCapabilities {
  /** True only when the server has a key. The key itself never comes back. */
  live: boolean;
  model: string;
  maxSeconds: number;
  /** False until the probe answers, so the UI can avoid claiming either way. */
  probed: boolean;
}

/** How many bars the meter keeps. Matches the Mac app's rolling level history. */
const BARS = 28;
const METER_MS = 60;
/** Below this a take is a slip of the finger, not a sentence. */
const MIN_TAKE_MS = 700;
const MIN_BLOB_BYTES = 1_200;

const EMPTY_LEVELS: number[] = Array.from({ length: BARS }, () => 0);

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
];

const EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'video/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

function extensionFor(type: string): string {
  const base = type.split(';')[0]?.trim().toLowerCase() ?? '';
  return EXTENSIONS[base] ?? 'webm';
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

/** Shape of everything /api/whisper can answer with. */
interface WhisperResponse {
  text?: string;
  model?: string;
  source?: string;
  fallback?: 'demo';
  reason?: string;
  notice?: string;
  error?: string;
}

export interface UseDictationResult {
  mode: DictationMode;
  setMode: (mode: DictationMode) => void;
  phase: DictationPhase;
  /** One sentence about the current state. Null when there is nothing to say. */
  notice: string | null;
  mic: MicState;
  levels: number[];
  elapsedMs: number;
  caps: WhisperCapabilities;
  /** The partially typed demo line. Empty except during `typing`. */
  pending: string;
  busy: boolean;
  start: () => void;
  stop: () => void;
  cancel: () => void;
  dismissNotice: () => void;
}

export function useDictation(
  onUtterance: (text: string, source: DictationSource) => void,
): UseDictationResult {
  const [mode, setMode] = useState<DictationMode>('demo');
  const [phase, setPhase] = useState<DictationPhase>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  const [mic, setMic] = useState<MicState>('unknown');
  const [levels, setLevels] = useState<number[]>(EMPTY_LEVELS);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [pending, setPending] = useState('');
  const [caps, setCaps] = useState<WhisperCapabilities>({
    live: false,
    model: '',
    maxSeconds: 60,
    probed: false,
  });

  // The callback changes identity every render (it closes over app state), so it
  // is mirrored into a ref rather than threaded through every timer's deps.
  const onUtteranceRef = useRef(onUtterance);
  useEffect(() => {
    onUtteranceRef.current = onUtterance;
  }, [onUtterance]);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);
  const startedAtRef = useRef(0);
  const demoIndexRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const meterRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ------------------------------------------------------------ teardown -- */

  const clearTimers = useCallback(() => {
    for (const timer of timersRef.current) clearTimeout(timer);
    timersRef.current = [];
    if (meterRef.current) {
      clearInterval(meterRef.current);
      meterRef.current = null;
    }
    if (elapsedRef.current) {
      clearInterval(elapsedRef.current);
      elapsedRef.current = null;
    }
    if (typeRef.current) {
      clearInterval(typeRef.current);
      typeRef.current = null;
    }
  }, []);

  /**
   * Release the microphone. Called on every exit from a take — finished,
   * cancelled, failed or unmounted — because a live MediaStreamTrack is what
   * keeps the browser's recording indicator lit.
   */
  const releaseCapture = useCallback(() => {
    clearTimers();
    setLevels(EMPTY_LEVELS);
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {
        // Already closed, or closing during teardown. Nothing to recover.
      });
      audioCtxRef.current = null;
    }
    recorderRef.current = null;
  }, [clearTimers]);

  useEffect(() => releaseCapture, [releaseCapture]);

  const fail = useCallback(
    (message: string) => {
      releaseCapture();
      setPending('');
      setNotice(message);
      setPhase('failed');
    },
    [releaseCapture],
  );

  /* --------------------------------------------------------- capability --- */

  useEffect(() => {
    let alive = true;

    // Same-origin. The server decides whether live dictation is possible; the
    // browser is never told anything about the key beyond yes or no.
    fetch('/api/whisper', { method: 'GET' })
      .then((res) => (res.ok ? (res.json() as Promise<Record<string, unknown>>) : null))
      .then((data) => {
        if (!alive) return;
        const live = data?.live === true;
        setCaps({
          live,
          model: typeof data?.model === 'string' ? data.model : '',
          maxSeconds: typeof data?.maxSeconds === 'number' ? data.maxSeconds : 60,
          probed: true,
        });
        // Demo is the default, so this only ever promotes: with a key configured
        // the app opens ready to actually listen.
        if (live) setMode('live');
      })
      .catch(() => {
        // The route is unreachable (dev server down, hard offline). Demo mode is
        // already the default, so there is nothing to change and nothing worth
        // interrupting the user about.
        if (alive) setCaps((prev) => ({ ...prev, probed: true }));
      });

    return () => {
      alive = false;
    };
  }, []);

  // A best-effort read of the standing permission, so Settings can show the
  // state before anyone presses Record. Not supported everywhere, and never
  // load-bearing — the real answer always comes from getUserMedia.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return;
    let alive = true;
    navigator.permissions
      // 'microphone' is a valid PermissionName at runtime but is missing from
      // the DOM lib's union, so the cast is the narrowest way to ask.
      .query({ name: 'microphone' as PermissionName })
      .then((status) => {
        if (!alive) return;
        if (status.state === 'granted') setMic('granted');
        else if (status.state === 'denied') setMic('denied');
      })
      .catch(() => {
        // Firefox and Safari reject on the microphone descriptor. Fine — the
        // state stays 'unknown' until a real request answers it.
      });
    return () => {
      alive = false;
    };
  }, []);

  /* -------------------------------------------------------------- meter --- */

  const pushLevel = useCallback((value: number) => {
    setLevels((prev) => [...prev.slice(1), value]);
  }, []);

  const startElapsed = useCallback(() => {
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    elapsedRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 250);
  }, []);

  /**
   * Attach an analyser to the live stream so the meter shows what the microphone
   * is actually hearing. Sampled on an interval rather than requestAnimationFrame:
   * these are readings, not an animation, and a 60 ms tick is plenty for bars
   * this small while staying honest about prefers-reduced-motion.
   */
  const attachMeter = useCallback(
    (stream: MediaStream) => {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;

      try {
        const ctx = new Ctor();
        audioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buffer = new Uint8Array(analyser.fftSize);

        meterRef.current = setInterval(() => {
          analyser.getByteTimeDomainData(buffer);
          let sum = 0;
          for (let i = 0; i < buffer.length; i += 1) {
            const sample = (buffer[i] - 128) / 128;
            sum += sample * sample;
          }
          pushLevel(Math.sqrt(sum / buffer.length));
        }, METER_MS);
      } catch {
        // No Web Audio (or the context was blocked). The take still works; the
        // meter simply stays flat, which is better than failing the dictation.
      }
    },
    [pushLevel],
  );

  /* ---------------------------------------------------------- transcribe -- */

  const transcribe = useCallback(
    async (blob: Blob, durationMs: number) => {
      if (durationMs < MIN_TAKE_MS || blob.size < MIN_BLOB_BYTES) {
        fail('That take was too short to transcribe. Hold Record for a second or two and speak.');
        return;
      }

      setPhase('transcribing');
      setNotice(null);

      try {
        const form = new FormData();
        form.append('audio', blob, `dictation.${extensionFor(blob.type)}`);

        // Same-origin, always. The browser must never call api.openai.com
        // itself — the server does that, which is what keeps the page's
        // no-cross-origin-requests guarantee intact.
        const res = await fetch('/api/whisper', { method: 'POST', body: form });
        const data = (await res.json().catch(() => null)) as WhisperResponse | null;

        if (!data) {
          fail('The transcription service sent something unreadable.');
          return;
        }
        if (!res.ok) {
          fail(data.notice ?? 'That recording could not be sent.');
          return;
        }
        if (data.fallback === 'demo') {
          // Not an error state: the server is telling us live dictation is off
          // right now and demo mode is the working alternative.
          setNotice(data.notice ?? 'Live dictation is unavailable. Switched to demo mode.');
          setMode('demo');
          setPhase('idle');
          return;
        }

        const text = (data.text ?? '').trim();
        if (!text) {
          fail('Nothing came back from that recording. Check which microphone is selected.');
          return;
        }

        setPhase('idle');
        setNotice(null);
        onUtteranceRef.current(text, 'live');
      } catch {
        // The request never landed: offline, or this server is gone.
        setNotice('Could not reach this site’s server. Switched to demo mode.');
        setMode('demo');
        setPhase('idle');
      }
    },
    [fail],
  );

  /* --------------------------------------------------------------- live --- */

  const handleMicError = useCallback(
    (err: unknown) => {
      const name = err instanceof DOMException ? err.name : '';
      const message = err instanceof Error ? err.message.toLowerCase() : '';

      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        if (message.includes('dismiss')) {
          setMic('dismissed');
          fail('The microphone prompt was closed without an answer. Press Record to be asked again.');
        } else {
          setMic('denied');
          fail(
            'Microphone access is blocked for this site. Allow it in the browser’s site settings, then press Record again — or use demo mode, which needs no microphone.',
          );
        }
        return;
      }
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setMic('missing');
        fail('No microphone is attached to this machine. Demo mode needs no microphone.');
        return;
      }
      if (name === 'NotReadableError' || name === 'TrackStartError') {
        setMic('busy');
        fail('The microphone is in use by another application. Close it and try again.');
        return;
      }
      if (name === 'SecurityError') {
        setMic('unsupported');
        fail('A page has to be served over HTTPS to open a microphone. Demo mode still works.');
        return;
      }
      setMic('unknown');
      fail('The microphone would not start. Demo mode still works.');
    },
    [fail],
  );

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      // Everything after this happens in the recorder's onstop handler, which is
      // the only place that sees the final chunk.
      recorder.stop();
      return;
    }
    // Demo mode, or a live take that never got off the ground. `transcribing`
    // is deliberately not reset here — that request is already in flight and
    // owns the ending.
    clearTimers();
    if (phase === 'recording' || phase === 'typing' || phase === 'arming') setPhase('idle');
  }, [clearTimers, phase]);

  const startLive = useCallback(async () => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setMic('unsupported');
      fail('This browser will not hand a page a microphone here. Demo mode still works.');
      return;
    }

    setNotice(null);
    setPending('');
    setPhase('arming');

    let stream: MediaStream;
    try {
      // Plain `audio: true`. Nothing is asked of the browser's own processing —
      // noise suppression is the Mac app's job and is deliberately out of scope
      // here.
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      handleMicError(err);
      return;
    }

    setMic('granted');
    streamRef.current = stream;
    chunksRef.current = [];
    cancelledRef.current = false;

    let recorder: MediaRecorder;
    try {
      const mimeType = pickMimeType();
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      try {
        recorder = new MediaRecorder(stream);
      } catch {
        fail('This browser cannot record audio. Demo mode still works.');
        return;
      }
    }

    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      const duration = Date.now() - startedAtRef.current;
      const type = recorder.mimeType || 'audio/webm';
      const chunks = chunksRef.current;
      chunksRef.current = [];
      const cancelled = cancelledRef.current;
      cancelledRef.current = false;

      releaseCapture();

      if (cancelled) {
        setPhase('idle');
        setNotice('Take cancelled. Nothing was sent.');
        return;
      }
      // The Blob is passed straight to transcribe() and then dropped. Raw audio
      // is never written to storage.
      void transcribe(new Blob(chunks, { type }), duration);
    };

    recorder.onerror = () => {
      fail('The recorder stopped unexpectedly. Nothing was sent.');
    };

    try {
      recorder.start();
    } catch {
      fail('The recorder would not start. Nothing was sent.');
      return;
    }

    setPhase('recording');
    startElapsed();
    attachMeter(stream);

    // A take has a ceiling. Left running, a forgotten window would hold the
    // microphone open indefinitely.
    timersRef.current.push(
      setTimeout(() => {
        setNotice(`Stopped at the ${caps.maxSeconds}-second limit for one take.`);
        stop();
      }, caps.maxSeconds * 1000),
    );
  }, [attachMeter, caps.maxSeconds, fail, handleMicError, releaseCapture, startElapsed, stop, transcribe]);

  /* --------------------------------------------------------------- demo --- */

  const typeOut = useCallback((line: string) => {
    if (prefersReducedMotion()) {
      setPending('');
      setPhase('idle');
      onUtteranceRef.current(line, 'demo');
      return;
    }

    setPhase('typing');
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setPending(line.slice(0, index));
      if (index >= line.length) {
        clearInterval(timer);
        typeRef.current = null;
        setPending('');
        setPhase('idle');
        // Emitted only once the whole line has landed, so nothing downstream
        // ever receives half a sentence.
        onUtteranceRef.current(line, 'demo');
      }
    }, DEMO_TYPE_MS);
    typeRef.current = timer;
  }, []);

  const startDemo = useCallback(() => {
    clearTimers();
    setNotice(null);
    setPending('');
    setPhase('recording');
    startElapsed();

    const reduced = prefersReducedMotion();
    let tick = 0;
    meterRef.current = setInterval(() => {
      tick += 1;
      pushLevel(demoLevel(tick));
    }, METER_MS);

    // Deterministic order rather than random, so the demo is the same story
    // twice and a test can rely on it.
    const line = DEMO_TRANSCRIPTS[demoIndexRef.current % DEMO_TRANSCRIPTS.length];
    demoIndexRef.current += 1;

    timersRef.current.push(
      setTimeout(
        () => {
          clearTimers();
          setLevels(EMPTY_LEVELS);
          setPhase('transcribing');
          timersRef.current.push(
            setTimeout(() => typeOut(line), reduced ? 60 : DEMO_TRANSCRIBE_MS),
          );
        },
        reduced ? 300 : DEMO_RECORD_MS,
      ),
    );
  }, [clearTimers, pushLevel, startElapsed, typeOut]);

  /* ------------------------------------------------------------ controls -- */

  const start = useCallback(() => {
    if (phase === 'recording' || phase === 'arming' || phase === 'transcribing' || phase === 'typing') {
      return;
    }
    if (mode === 'demo') {
      startDemo();
      return;
    }
    void startLive();
  }, [mode, phase, startDemo, startLive]);

  const cancel = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      // The recorder's onstop handler reads this flag and drops the audio
      // instead of uploading it.
      cancelledRef.current = true;
      recorderRef.current.stop();
      return;
    }
    const wasRunning = phase !== 'idle' && phase !== 'failed';
    releaseCapture();
    setPending('');
    setPhase('idle');
    if (wasRunning) setNotice('Take cancelled. Nothing was sent.');
  }, [phase, releaseCapture]);

  // Backgrounding the tab ends the take. The Mac app records while you are in
  // another application by design; a web page must not, and a mic held open
  // behind a hidden tab is exactly the thing that deserves suspicion.
  useEffect(() => {
    if (phase !== 'recording' && phase !== 'arming') return;
    const onHide = () => {
      if (document.visibilityState !== 'hidden') return;
      setNotice('Recording stopped because this tab went to the background.');
      stop();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [phase, stop]);

  const changeMode = useCallback(
    (next: DictationMode) => {
      // Live is only selectable when the server actually has a key. Offering it
      // otherwise would just be a button that always fails.
      if (next === 'live' && !caps.live) return;
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        cancelledRef.current = true;
        recorderRef.current.stop();
      }
      releaseCapture();
      setPending('');
      setPhase('idle');
      setNotice(null);
      setMode(next);
    },
    [caps.live, releaseCapture],
  );

  return {
    mode,
    setMode: changeMode,
    phase,
    notice,
    mic,
    levels,
    elapsedMs,
    caps,
    pending,
    busy: phase === 'arming' || phase === 'transcribing' || phase === 'typing',
    start,
    stop,
    cancel,
    dismissNotice: () => setNotice(null),
  };
}
