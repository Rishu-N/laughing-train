'use client';

/**
 * The Browser — the window that opens by itself on boot, and therefore the
 * first thing anybody sees.
 *
 * It is a real (if very small) browser: an honest history stack, working back
 * and forward buttons, a location bar you can type a bad URL into and get a 404
 * from, a stop button that actually cancels the load, and a status bar that
 * mirrors link targets on hover.
 *
 * The chrome is System 7 (tokens + shared primitives from @/components/os/ui).
 * Everything inside the viewport is a 1996 web page (see ./retro.tsx). No copy
 * about the site's owner lives in this file — it all comes from content/bio.ts
 * by way of ./site.tsx.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppFrame,
  Button,
  IconButton,
  StatusBar,
  TextField,
  Toolbar,
  ToolbarLabel,
  ToolbarSeparator,
  ToolbarSpacer,
} from '@/components/os/ui';
import type { AppWindowProps } from '@/lib/os/types';
import { BrowserNavProvider, normalizePath, pageUrl, SITE_HOST } from './retro';
import { getPage, HOME_PATH, NotFoundPage } from './site';

/* The fake load: short enough to be charming, long enough to be noticed. */
const LOAD_STEPS = 6;
const LOAD_TICK_MS = 50; // 6 x 50ms = ~300ms end to end
const DONE_TEXT = 'Document: Done';

interface HistoryState {
  entries: string[];
  index: number;
}

export default function BrowserApp({ setTitle }: AppWindowProps) {
  const [history, setHistory] = useState<HistoryState>({
    entries: [HOME_PATH],
    index: 0,
  });
  const path = history.entries[history.index] ?? HOME_PATH;

  /** Bumped by reload so the same path can be fetched twice. */
  const [loadSeq, setLoadSeq] = useState(0);
  /** null while idle; 0–100 while a page is "loading". */
  const [progress, setProgress] = useState<number | null>(null);
  const [statusText, setStatusText] = useState('Ready');
  const [hoverUrl, setHoverUrl] = useState<string | null>(null);
  const [visited, setVisited] = useState<string[]>([HOME_PATH]);
  /**
   * What the user has typed into the location bar, or null when they haven't
   * touched it — in which case the bar mirrors the current page. Deriving it
   * this way means navigating never has to "push" a value back into the field.
   */
  const [addressDraft, setAddressDraft] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);

  const page = useMemo(() => getPage(path), [path]);

  /* ------------------------------------------------------------ routing -- */

  const navigate = useCallback((next: string) => {
    const target = normalizePath(next);
    setHistory((h) => {
      if (h.entries[h.index] === target) return h; // already here: no new entry
      const entries = [...h.entries.slice(0, h.index + 1), target];
      return { entries, index: entries.length - 1 };
    });
    setVisited((v) => (v.includes(target) ? v : [...v, target]));
    setHoverUrl(null);
    setAddressDraft(null);
  }, []);

  const go = useCallback((delta: number) => {
    setHistory((h) => {
      const index = h.index + delta;
      if (index < 0 || index >= h.entries.length) return h;
      return { ...h, index };
    });
    setHoverUrl(null);
    setAddressDraft(null);
  }, []);

  const canGoBack = history.index > 0;
  const canGoForward = history.index < history.entries.length - 1;

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setProgress(null);
    setStatusText('Stopped');
  }, []);

  /* --------------------------------------------------------- fake load --- */

  /**
   * Every navigation and every reload runs a short fake fetch. All the state
   * changes happen inside the interval callback rather than in the effect body,
   * so this stays a subscription to a timer instead of a cascading render.
   */
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const id = window.setTimeout(() => {
        setProgress(null);
        setStatusText(DONE_TEXT);
      }, 0);
      return () => window.clearTimeout(id);
    }

    let step = 0;
    const id = window.setInterval(() => {
      step += 1;
      if (step >= LOAD_STEPS) {
        window.clearInterval(id);
        timerRef.current = null;
        setProgress(null);
        setStatusText(DONE_TEXT);
        return;
      }
      setProgress(Math.round((step / LOAD_STEPS) * 100));
      setStatusText(
        step < 3
          ? `Connect: Host ${SITE_HOST} contacted. Waiting for reply…`
          : `Reading ${SITE_HOST}…`,
      );
    }, LOAD_TICK_MS);
    timerRef.current = id;

    return () => {
      window.clearInterval(id);
      timerRef.current = null;
    };
  }, [path, loadSeq]);

  /* ------------------------------------------- address bar + window title */

  const address = addressDraft ?? pageUrl(path);

  useEffect(() => {
    setTitle(page ? `Browser: ${page.title}` : 'Browser: Not Found');
  }, [page, setTitle]);

  const submitAddress = useCallback(() => {
    navigate(address);
  }, [address, navigate]);

  const nav = useMemo(
    () => ({
      navigate,
      isVisited: (p: string) => visited.includes(p),
      setHover: setHoverUrl,
    }),
    [navigate, visited],
  );

  /* -------------------------------------------------------------- chrome */

  const toolbar = (
    <>
      <Toolbar>
        <IconButton label="Back" disabled={!canGoBack} onClick={() => go(-1)}>
          <span aria-hidden>&#9664;</span>
        </IconButton>
        <IconButton label="Forward" disabled={!canGoForward} onClick={() => go(1)}>
          <span aria-hidden>&#9654;</span>
        </IconButton>
        <ToolbarSeparator />
        <IconButton label="Stop" disabled={progress === null} onClick={stop}>
          <span aria-hidden>&#10005;</span>
        </IconButton>
        <IconButton label="Reload" onClick={() => setLoadSeq((n) => n + 1)}>
          <span aria-hidden>&#8635;</span>
        </IconButton>
        <IconButton label="Home" onClick={() => navigate(HOME_PATH)}>
          <span aria-hidden>&#8962;</span>
        </IconButton>
        <ToolbarSpacer />
        <ToolbarLabel>{progress === null ? 'Idle' : 'Busy'}</ToolbarLabel>
      </Toolbar>

      <Toolbar>
        <ToolbarLabel>Location:</ToolbarLabel>
        <TextField
          aria-label="Location"
          spellCheck={false}
          autoComplete="off"
          className="flex-1"
          value={address}
          onChange={(e) => setAddressDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submitAddress();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setAddressDraft(null);
            }
          }}
        />
        <Button onClick={submitAddress}>Go</Button>
      </Toolbar>
    </>
  );

  const status = (
    <StatusBar>
      <span className="min-w-0 flex-1 truncate">{hoverUrl ?? statusText}</span>
      {progress !== null && (
        <span
          className="os-inset relative h-[10px] w-[64px] shrink-0 overflow-hidden rounded-[1px]"
          role="progressbar"
          aria-label="Loading"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span
            className="absolute inset-y-0 left-0 bg-os-accent"
            style={{ width: `${progress}%` }}
          />
        </span>
      )}
      <span className="shrink-0 opacity-60" aria-hidden>
        {history.index + 1}/{history.entries.length}
      </span>
    </StatusBar>
  );

  const PageComponent = page?.Component;

  return (
    <BrowserNavProvider value={nav}>
      <AppFrame toolbar={toolbar} status={status}>
        {PageComponent ? <PageComponent /> : <NotFoundPage path={path} />}
      </AppFrame>
    </BrowserNavProvider>
  );
}
