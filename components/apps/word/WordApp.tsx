'use client';

/**
 * Word — a simplified word processor: a page on a grey desk, a ruler for looks,
 * and a toolbar over a contenteditable surface.
 *
 * All rich-text mutation goes through ./richText so the deprecated execCommand
 * API stays in exactly one file.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppFrame,
  Button,
  ConfirmDialog,
  IconButton,
  Select,
  StatusBar,
  Toolbar,
  ToolbarSeparator,
  ToolbarSpacer,
} from '@/components/os/ui';
import { useAppSession } from '@/lib/os/persist';
import type { AppWindowProps } from '@/lib/os/types';
import {
  ALIGN_COMMAND,
  FONT_FAMILIES,
  FONT_SIZES,
  currentAlignment,
  isActive,
  preferCssStyling,
  runCommand,
  sanitizeStoredHtml,
  type Alignment,
  type RichCommand,
} from './richText';

interface WordSession {
  html: string;
}

const EMPTY: WordSession = { html: '' };

const ALIGN_RULE_WIDTHS = ['100%', '70%', '100%', '55%'];

function AlignGlyph({ align }: { align: Alignment }) {
  const justify =
    align === 'left' ? 'items-start' : align === 'center' ? 'items-center' : 'items-end';
  return (
    <span aria-hidden className={`flex w-[13px] flex-col gap-[2px] ${justify}`}>
      {ALIGN_RULE_WIDTHS.map((w, i) => (
        <span key={i} className="h-px bg-current" style={{ width: w }} />
      ))}
    </span>
  );
}

export default function WordApp({ setTitle }: AppWindowProps) {
  const [doc, setDoc, reset, hydrated] = useAppSession<WordSession>('word', EMPTY);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const appliedRef = useRef(false);

  const [confirmNew, setConfirmNew] = useState(false);
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [underline, setUnderline] = useState(false);
  const [align, setAlign] = useState<Alignment>('left');
  const [fontSize, setFontSize] = useState('3');
  const [fontFamily, setFontFamily] = useState(FONT_FAMILIES[0].value);
  const [counts, setCounts] = useState({ words: 0, chars: 0 });

  const recount = useCallback(() => {
    const text = editorRef.current?.innerText ?? '';
    const trimmed = text.replace(/\u00a0/g, ' ').trim();
    setCounts({
      words: trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length,
      chars: text.length,
    });
  }, []);

  /* Apply the persisted document once, imperatively. React cannot own the
     children of a contenteditable without fighting the caret, and this keeps us
     clear of dangerouslySetInnerHTML.

     It is scrubbed on the way in. This app wrote the HTML, but localStorage is
     writable by anything that ever runs on this origin, so "we serialised it"
     is not the same claim as "it is what we serialised" — and an assignment to
     innerHTML is the one place on this desktop where the difference would
     matter. sanitizeStoredHtml parses it inside an inert <template>, where
     nothing executes and nothing fetches, and keeps only an allowlist. */
  useEffect(() => {
    if (!hydrated || appliedRef.current) return;
    appliedRef.current = true;
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = sanitizeStoredHtml(doc.html);
    preferCssStyling();
    recount();
  }, [hydrated, doc.html, recount]);

  useEffect(() => {
    setTitle('Untitled');
  }, [setTitle]);

  const syncFormatState = useCallback(() => {
    const el = editorRef.current;
    const selection = document.getSelection();
    if (!el || !selection || !selection.anchorNode) return;
    if (!el.contains(selection.anchorNode)) return;
    setBold(isActive('bold'));
    setItalic(isActive('italic'));
    setUnderline(isActive('underline'));
    setAlign(currentAlignment());
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', syncFormatState);
    return () => document.removeEventListener('selectionchange', syncFormatState);
  }, [syncFormatState]);

  const persist = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    setDoc((d) => (d.html === html ? d : { html }));
    recount();
  }, [setDoc, recount]);

  const apply = useCallback(
    (command: RichCommand, value?: string) => {
      editorRef.current?.focus();
      runCommand(command, value);
      syncFormatState();
      persist();
    },
    [syncFormatState, persist],
  );

  const startNew = () => {
    reset();
    if (editorRef.current) editorRef.current.innerHTML = '';
    setConfirmNew(false);
    setCounts({ words: 0, chars: 0 });
    editorRef.current?.focus();
  };

  return (
    <AppFrame
      scroll={false}
      toolbar={
        <Toolbar className="flex-wrap">
          <Button onClick={() => setConfirmNew(true)}>New</Button>
          <ToolbarSeparator />
          <IconButton label="Bold" active={bold} onClick={() => apply('bold')}>
            <span className="font-bold">B</span>
          </IconButton>
          <IconButton label="Italic" active={italic} onClick={() => apply('italic')}>
            <span className="italic">I</span>
          </IconButton>
          <IconButton label="Underline" active={underline} onClick={() => apply('underline')}>
            <span className="underline">U</span>
          </IconButton>
          <ToolbarSeparator />
          {(['left', 'center', 'right'] as Alignment[]).map((a) => (
            <IconButton
              key={a}
              label={`Align ${a}`}
              active={align === a}
              onClick={() => apply(ALIGN_COMMAND[a])}
            >
              <AlignGlyph align={a} />
            </IconButton>
          ))}
          <ToolbarSeparator />
          <Select
            aria-label="Font"
            value={fontFamily}
            onChange={(e) => {
              setFontFamily(e.target.value);
              apply('fontName', e.target.value);
            }}
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Font size"
            value={fontSize}
            onChange={(e) => {
              setFontSize(e.target.value);
              apply('fontSize', e.target.value);
            }}
          >
            {FONT_SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <ToolbarSpacer />
        </Toolbar>
      }
      status={
        <StatusBar>
          <span>
            {counts.words} {counts.words === 1 ? 'word' : 'words'}
          </span>
          <span className="text-os-ink-soft">{counts.chars} chars</span>
          <ToolbarSpacer />
          <span className="text-os-ink-soft">Page 1</span>
        </StatusBar>
      }
    >
      <div className="flex h-full w-full flex-col">
        {/* Ruler — decorative, but it is what makes the page read as a document. */}
        <div className="flex shrink-0 justify-center border-b border-os-ink bg-os-chrome px-2 py-1">
          <div
            aria-hidden
            className="h-[14px] w-full max-w-[640px] border border-os-chrome-dark bg-os-face"
            style={{
              backgroundImage:
                'repeating-linear-gradient(to right, var(--color-os-ink-soft) 0 1px, transparent 1px 8px), repeating-linear-gradient(to right, var(--color-os-ink) 0 1px, transparent 1px 64px)',
              backgroundSize: '100% 5px, 100% 9px',
              backgroundPosition: 'left bottom, left bottom',
              backgroundRepeat: 'repeat-x',
            }}
          />
        </div>

        {/* The desk. */}
        <div className="os-scroll min-h-0 flex-1 overflow-auto bg-os-well p-3">
          <div className="mx-auto w-full max-w-[640px] border border-os-ink bg-os-face px-6 py-6 shadow-[2px_2px_0_0_rgba(0,0,0,0.4)] sm:px-12 sm:py-10">
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              aria-label="Document"
              spellCheck
              onInput={persist}
              onBlur={persist}
              onKeyUp={syncFormatState}
              onMouseUp={syncFormatState}
              className="min-h-[420px] font-[family-name:var(--font-os-body)] text-[13px] leading-[1.55] text-os-ink outline-none"
            />
          </div>
        </div>
      </div>

      {confirmNew && (
        <ConfirmDialog
          title="Word"
          message="Discard the current document?"
          confirmLabel="New"
          onConfirm={startNew}
          onCancel={() => setConfirmNew(false)}
        />
      )}
    </AppFrame>
  );
}
