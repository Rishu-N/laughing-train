'use client';

/**
 * Terminal — a CRT-styled shell for the OS.
 *
 * Input is parsed locally first (lib/terminal/commands.ts). Only text that
 * matches no command is sent to /api/terminal, which is the single piece of
 * server-side code in the project.
 *
 * OWNER: Terminal agent.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { AppFrame, Button, StatusBar, Toolbar, ToolbarSpacer } from '@/components/os/ui';
import { useAppSession } from '@/lib/os/persist';
import type { AppWindowProps } from '@/lib/os/types';
import { askAssistant } from '@/lib/terminal/client';
import { bootLines, complete, runCommand } from '@/lib/terminal/commands';
import type { ChatTurn, LineKind, OutputLine, TerminalLine } from '@/lib/terminal/types';
import { CrtStyles } from './crt';

const PROMPT = '>';

/** Scrollback ceiling — a runaway `history` loop should not eat the tab. */
const MAX_LINES = 400;

const KIND_CLASS: Record<LineKind, string> = {
  system: 'text-os-phosphor-dim',
  input: 'text-os-phosphor',
  output: 'text-os-phosphor',
  error: 'text-os-warn',
  ai: 'text-os-phosphor',
  pending: 'text-os-phosphor-dim',
};

export default function TerminalApp({ close }: AppWindowProps) {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [offlineHint, setOfflineHint] = useState(false);

  // CRT effects are an accessibility switch, so the choice is remembered
  // through the shared session mechanism rather than a hand-rolled key.
  const [prefs, setPrefs] = useAppSession('terminal', { crt: true });
  const crt = prefs.crt;

  const idRef = useRef(0);
  const bootedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  /** Submitted command strings, oldest first. */
  const historyRef = useRef<string[]>([]);
  /** Where ArrowUp/ArrowDown currently are; -1 means "on the live line". */
  const cursorRef = useRef(-1);
  /** Conversation replayed to the assistant for context. */
  const chatRef = useRef<ChatTurn[]>([]);

  const push = useCallback((incoming: OutputLine[]) => {
    if (incoming.length === 0) return;
    setLines((prev) => {
      const next = [
        ...prev,
        ...incoming.map((line) => ({ ...line, id: (idRef.current += 1) })),
      ];
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
    });
  }, []);

  const focusInput = useCallback(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  /* Banner + help on open, and focus the input. The ref guard keeps React's
     development double-mount from printing the banner twice. */
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    push(bootLines());
    focusInput();
  }, [push, focusInput]);

  /* Always pinned to the bottom, like a real terminal. */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, busy]);

  const setCrt = useCallback(
    (next: boolean) => setPrefs((prev) => ({ ...prev, crt: next })),
    [setPrefs],
  );

  const ask = useCallback(
    async (input: string) => {
      setBusy(true);
      const pendingId = (idRef.current += 1);
      setLines((prev) => [...prev, { id: pendingId, kind: 'pending', text: '...' }]);

      const { reply, offline } = await askAssistant(input, chatRef.current);

      const turns: ChatTurn[] = [
        ...chatRef.current,
        { role: 'user', content: input },
        { role: 'assistant', content: reply },
      ];
      chatRef.current = turns.slice(-16);

      setOfflineHint(Boolean(offline));
      setLines((prev) =>
        prev.map((line) =>
          line.id === pendingId ? { ...line, kind: 'ai' as const, text: reply } : line,
        ),
      );
      setBusy(false);
      focusInput();
    },
    [focusInput],
  );

  const submit = useCallback(() => {
    if (busy) return;
    const raw = value;
    setValue('');
    cursorRef.current = -1;

    push([{ kind: 'input', text: `${PROMPT} ${raw}` }]);

    const trimmed = raw.trim();
    if (!trimmed) return;

    if (historyRef.current[historyRef.current.length - 1] !== trimmed) {
      historyRef.current = [...historyRef.current, trimmed].slice(-100);
    }

    const result = runCommand(raw, { history: historyRef.current, crt });
    if (result.type === 'blank') return;

    if (result.type === 'llm') {
      void ask(result.input);
      return;
    }

    const { outcome } = result;
    if (outcome.clear) setLines([]);
    push(outcome.lines);
    if (outcome.crt) setCrt(outcome.crt === 'toggle' ? !crt : outcome.crt === 'on');
    if (outcome.exit) {
      // Let the goodbye line paint before the window disappears.
      window.setTimeout(close, 180);
    }
  }, [busy, value, crt, push, ask, setCrt, close]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      const history = historyRef.current;

      if (event.key === 'Enter') {
        event.preventDefault();
        submit();
        return;
      }

      if (event.key === 'Tab') {
        event.preventDefault();
        const { value: completed, suggestions } = complete(value);
        setValue(completed);
        if (suggestions.length > 1) {
          push([
            { kind: 'input', text: `${PROMPT} ${value}` },
            { kind: 'system', text: `  ${suggestions.join('   ')}` },
          ]);
        }
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (history.length === 0) return;
        const next = cursorRef.current < 0 ? history.length - 1 : Math.max(0, cursorRef.current - 1);
        cursorRef.current = next;
        setValue(history[next]);
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (cursorRef.current < 0) return;
        const next = cursorRef.current + 1;
        if (next >= history.length) {
          cursorRef.current = -1;
          setValue('');
          return;
        }
        cursorRef.current = next;
        setValue(history[next]);
        return;
      }

      // Two shell reflexes worth honouring.
      if (event.ctrlKey && (event.key === 'l' || event.key === 'L')) {
        event.preventDefault();
        setLines([]);
        return;
      }
      if (event.ctrlKey && (event.key === 'c' || event.key === 'C')) {
        event.preventDefault();
        push([{ kind: 'input', text: `${PROMPT} ${value}^C` }]);
        setValue('');
        cursorRef.current = -1;
      }
    },
    [value, submit, push],
  );

  /** Clicking the screen focuses the prompt — unless the user is selecting. */
  const onScreenClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target instanceof HTMLElement && event.target.closest('button')) return;
      if (window.getSelection()?.toString()) return;
      focusInput();
    },
    [focusInput],
  );

  return (
    <AppFrame
      scroll={false}
      className="bg-os-ink"
      toolbar={
        <Toolbar>
          <Button onClick={() => setCrt(!crt)} aria-pressed={crt}>
            {crt ? 'CRT: On' : 'CRT: Off'}
          </Button>
          <ToolbarSpacer />
          <Button
            onClick={() => {
              setLines([]);
              focusInput();
            }}
          >
            Clear
          </Button>
        </Toolbar>
      }
      status={
        <StatusBar>
          <span>{busy ? 'Working…' : offlineHint ? 'Link down' : 'Ready'}</span>
          <ToolbarSpacer />
          <span>Type help</span>
        </StatusBar>
      }
    >
      <CrtStyles />
      <div
        onClick={onScreenClick}
        className={`tm-screen h-full w-full bg-os-ink ${crt ? 'tm-crt' : ''}`}
      >
        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-label="Terminal output"
          className="os-scroll h-full w-full overflow-y-auto overflow-x-hidden px-2 py-1.5 font-[family-name:var(--font-os-mono)] text-[17px] leading-[1.25]"
        >
          {lines.map((line) => (
            <div
              key={line.id}
              className={`tm-text whitespace-pre-wrap break-words ${KIND_CLASS[line.kind]}`}
            >
              {line.text === '' ? ' ' : line.text}
            </div>
          ))}

          {/* The live prompt. The real <input> sits transparently on top of a
              mirrored copy of the text, which is what lets us draw a chunky
              block cursor instead of the browser caret. */}
          <div className="relative flex items-start">
            <span aria-hidden className="tm-text shrink-0 text-os-phosphor">
              {PROMPT}&nbsp;
            </span>
            <span
              aria-hidden
              className="tm-text min-w-0 flex-1 whitespace-pre-wrap break-words text-os-phosphor"
            >
              {value}
              {!busy && <span className="tm-cursor" />}
            </span>
            <input
              ref={inputRef}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={onKeyDown}
              disabled={busy}
              aria-label="Terminal input"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent outline-none"
            />
          </div>
        </div>

        {crt && (
          <>
            <div aria-hidden className="tm-overlay tm-scanlines" />
            <div aria-hidden className="tm-overlay tm-bloom" />
          </>
        )}
      </div>
    </AppFrame>
  );
}
