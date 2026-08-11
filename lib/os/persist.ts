'use client';

/**
 * Per-app "resume last session" persistence.
 *
 * FROZEN in Phase 0 — this is the single mechanism every app uses to remember
 * its document between visits. Do not hand-roll localStorage in an app.
 *
 *   const [doc, setDoc, reset] = useAppSession('notes', { text: '' });
 *
 * `reset()` clears storage and returns to the initial value — wire it to the
 * app's explicit "New" action, behind a confirm dialog.
 *
 * NOTE: the OS deliberately does NOT persist window layout. Every page load is a
 * fresh boot, which is what guarantees the Browser is the default open window.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const NAMESPACE = 'os90:v1';
const WRITE_DEBOUNCE_MS = 250;

export function storageKey(appId: string): string {
  return `${NAMESPACE}:${appId}`;
}

/** Read a persisted value outside React. Returns `fallback` on any failure. */
export function loadSession<T>(appId: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(storageKey(appId));
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt or unparseable entry — treat as absent rather than crashing the app.
    return fallback;
  }
}

/** Write a persisted value outside React. Silently no-ops if storage is unavailable. */
export function saveSession<T>(appId: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(appId), JSON.stringify(value));
  } catch {
    // Quota exceeded or storage disabled (private mode). Losing the autosave is
    // not worth taking the app down for.
  }
}

/** Remove a persisted value outside React. */
export function clearSession(appId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKey(appId));
  } catch {
    /* ignore */
  }
}

/**
 * Stateful, debounced, SSR-safe session storage.
 *
 * Returns `[value, setValue, reset, hydrated]`. `hydrated` is false on the first
 * render and true once the stored value has been read — useful if you need to
 * avoid flashing the empty state.
 */
export function useAppSession<T>(
  appId: string,
  initial: T,
): [T, (next: T | ((prev: T) => T)) => void, () => void, boolean] {
  // Start from `initial` so server and first client render agree, then hydrate
  // from localStorage in an effect. Reading storage during render would produce
  // a hydration mismatch.
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialRef = useRef(initial);

  useEffect(() => {
    setValue(loadSession(appId, initialRef.current));
    setHydrated(true);
  }, [appId]);

  // Debounced write. Skipped until hydration completes so we never overwrite a
  // stored document with the initial value on mount.
  useEffect(() => {
    if (!hydrated) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveSession(appId, value), WRITE_DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [appId, value, hydrated]);

  // Flush on unmount and on tab hide, so closing a window or navigating away
  // never loses the last few keystrokes sitting in the debounce window.
  useEffect(() => {
    if (!hydrated) return;
    const flush = () => saveSession(appId, valueRef.current);
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, [appId, hydrated]);

  const valueRef = useRef(value);
  valueRef.current = value;

  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    clearSession(appId);
    setValue(initialRef.current);
  }, [appId]);

  return [value, setValue, reset, hydrated];
}
