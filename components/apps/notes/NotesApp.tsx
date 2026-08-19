'use client';

/**
 * Notes — a plain-text scratchpad that always resumes where you left it.
 *
 * Deliberately dumb: no formatting, no files, one document. "New" is the only
 * destructive action and it sits behind a confirm.
 *
 * It is also the OS's dictation sink: while this window is open, transcripts
 * from WhisperFlow are appended to the document. That coupling runs entirely
 * through lib/os/dictation.ts — Notes knows nothing about WhisperFlow and does
 * not import it.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppFrame,
  Button,
  Checkbox,
  ConfirmDialog,
  StatusBar,
  Toolbar,
  ToolbarSpacer,
} from '@/components/os/ui';
import { useDictationStore } from '@/lib/os/dictation';
import { useAppSession } from '@/lib/os/persist';
import type { AppWindowProps } from '@/lib/os/types';

interface NotesSession {
  text: string;
  wrap: boolean;
}

const EMPTY: NotesSession = { text: '', wrap: false };

const LINE_HEIGHT = 19;

/** Title bar shows the first line, the way a Mac note pad page would. */
function titleFor(text: string): string {
  const first = text.split('\n').find((l) => l.trim().length > 0);
  if (!first) return 'Notes';
  const trimmed = first.trim();
  return trimmed.length > 28 ? `${trimmed.slice(0, 28)}…` : trimmed;
}

export default function NotesApp({ setTitle }: AppWindowProps) {
  const [doc, setDoc, reset, hydrated] = useAppSession<NotesSession>('notes', EMPTY);
  const [confirmNew, setConfirmNew] = useState(false);
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);

  const { text, wrap } = doc;

  const stats = useMemo(() => {
    const words = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
    return { words, chars: text.length, lines: text.split('\n').length };
  }, [text]);

  useEffect(() => {
    if (!hydrated) return;
    setTitle(titleFor(text));
  }, [text, hydrated, setTitle]);

  useEffect(() => {
    if (hydrated) textRef.current?.focus();
  }, [hydrated]);

  /* ------------------------------------------------------------ dictation -- */

  const lastDictation = useDictationStore((s) => s.last);
  const setSinkReady = useDictationStore((s) => s.setSinkReady);

  // Announce that a sink is on screen, so WhisperFlow can tell the user where
  // their words are about to land instead of guessing. Minimized windows stay
  // mounted, so a collapsed Notes still receives dictation — which is right.
  useEffect(() => {
    setSinkReady(true);
    return () => setSinkReady(false);
  }, [setSinkReady]);

  // Highest utterance id already written into the document. Null until the
  // stored note has hydrated, at which point the session's backlog is adopted
  // as "seen" — opening Notes should not replay everything dictated before it
  // existed, and appending before hydration would be overwritten anyway.
  const seenDictation = useRef<number | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (seenDictation.current === null) {
      seenDictation.current = lastDictation?.id ?? 0;
      return;
    }
    if (!lastDictation || lastDictation.id <= seenDictation.current) return;
    seenDictation.current = lastDictation.id;

    // Demo transcripts are scripted, not heard. The tag is the only place that
    // distinction survives once the text is sitting in a plain-text document.
    const line =
      lastDictation.source === 'demo' ? `[demo] ${lastDictation.text}` : lastDictation.text;
    setDoc((d) => ({
      ...d,
      text: d.text.trim().length === 0 ? line : `${d.text.replace(/\s*$/, '')}\n${line}`,
    }));
  }, [hydrated, lastDictation, setDoc]);

  const lineNumbers = useMemo(
    () => Array.from({ length: stats.lines }, (_, i) => i + 1),
    [stats.lines],
  );

  return (
    <AppFrame
      scroll={false}
      toolbar={
        <Toolbar>
          <Button onClick={() => setConfirmNew(true)}>New</Button>
          <ToolbarSpacer />
          <Checkbox
            label="Wrap"
            checked={wrap}
            onChange={(e) => setDoc((d) => ({ ...d, wrap: e.target.checked }))}
          />
        </Toolbar>
      }
      status={
        <StatusBar>
          <span>
            {stats.words} {stats.words === 1 ? 'word' : 'words'}
          </span>
          <span className="text-os-ink-soft">{stats.chars} chars</span>
          <ToolbarSpacer />
          <span className="text-os-ink-soft">
            {stats.lines} {stats.lines === 1 ? 'line' : 'lines'}
          </span>
        </StatusBar>
      }
    >
      <div className="flex h-full w-full min-w-0 bg-os-face">
        {!wrap && (
          <div
            ref={gutterRef}
            aria-hidden
            className="w-9 shrink-0 select-none overflow-hidden border-r border-os-chrome-dark bg-os-chrome py-2 text-right font-[family-name:var(--font-os-mono)] text-[16px] text-os-ink-soft"
            style={{ lineHeight: `${LINE_HEIGHT}px` }}
          >
            {lineNumbers.map((n) => (
              <div key={n} className="pr-1.5">
                {n}
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={textRef}
          value={text}
          spellCheck={false}
          wrap={wrap ? 'soft' : 'off'}
          onScroll={(e) => {
            if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
          }}
          onChange={(e) => {
            const next = e.target.value;
            setDoc((d) => ({ ...d, text: next }));
          }}
          className="os-scroll min-w-0 flex-1 resize-none bg-os-face px-2 py-2 font-[family-name:var(--font-os-mono)] text-[16px] text-os-ink outline-none"
          style={{ lineHeight: `${LINE_HEIGHT}px` }}
          aria-label="Note text"
        />
      </div>

      {confirmNew && (
        <ConfirmDialog
          title="Notes"
          message="Discard the current note?"
          confirmLabel="New"
          onConfirm={() => {
            reset();
            setConfirmNew(false);
            textRef.current?.focus();
          }}
          onCancel={() => setConfirmNew(false)}
        />
      )}
    </AppFrame>
  );
}
