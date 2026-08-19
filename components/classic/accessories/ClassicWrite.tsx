'use client';

/**
 * BitWrite — the 1984 shell's word processor.
 *
 * OWNER: Classic Boot agent.
 *
 * An application, not a desk accessory: launched from the startup disk and
 * deliberately absent from the mark menu (catalog.ts → APPLICATIONS).
 *
 * The ruler is the point of this window. The 1984 word processor's signature
 * interaction was dragging indent markers and dropping tab stops onto a ruler
 * and watching the paragraph move under them, and the colour OS's word
 * processor ships a ruler that is only decoration (HANDOFF.md §18). This one
 * works: the three markers drive the page's real margins, clicking the track
 * lays a tab stop, dragging one off the bottom throws it away, and the Tab key
 * measures the caret against those stops rather than counting characters —
 * which is the only way it can be right with mixed bold and italic runs in a
 * proportional face.
 *
 * ⚠️ There is no `dangerouslySetInnerHTML` here, and there will not be. The
 * stored document is reapplied imperatively and scrubbed on the way in by
 * sanitizeStoredHtml() — localStorage is writable by anything that ever runs on
 * this origin, so what comes back out is not trusted just because we wrote it.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { ICON_WRITE, type PixelMap } from '@/components/classic/icons';
import { BIT_FONT, BitButton } from '@/components/classic/ui/Bit';
import BitDialog from '@/components/classic/ui/BitDialog';
import PixelIcon from '@/components/classic/ui/PixelIcon';
import { BLACK_DITHER_STYLE } from '@/lib/classic/patterns';
import {
  ALIGNMENTS,
  DEFAULT_RULER,
  LINE_SPACINGS,
  WRITE_SESSION_ID,
  addTab,
  clampRuler,
  commandActive,
  countChars,
  countWords,
  currentAlignment,
  indentStyle,
  moveMarker,
  moveTab,
  nextTabStop,
  preferCssStyling,
  removeTab,
  rulerTicks,
  runCommand,
  sanitizeStoredHtml,
  spacingValue,
  type Alignment,
  type RulerMarker,
  type RulerState,
  type SpacingId,
} from '@/lib/classic/write';
import { useAppSession } from '@/lib/os/persist';

/* --------------------------------------------------------------- glyphs ---- */

/** Ruler markers. 7×4, in the '#'-is-a-pixel notation icons.ts uses. */
const M_FIRST: PixelMap = ['#######', '.#####.', '..###..', '...#...'];
const M_INDENT: PixelMap = ['...#...', '..###..', '.#####.', '#######'];
const M_TAB: PixelMap = ['#######', '...#...', '...#...', '...#...'];

/** Alignment buttons, 10×7: ragged edges say which way the text is flush. */
const A_LEFT: PixelMap = [
  '##########',
  '..........',
  '######....',
  '..........',
  '##########',
  '..........',
  '#####.....',
];
const A_CENTER: PixelMap = [
  '##########',
  '..........',
  '..######..',
  '..........',
  '##########',
  '..........',
  '..#####...',
];
const A_RIGHT: PixelMap = [
  '##########',
  '..........',
  '....######',
  '..........',
  '##########',
  '..........',
  '.....#####',
];
const A_JUSTIFY: PixelMap = [
  '##########',
  '..........',
  '##########',
  '..........',
  '##########',
  '..........',
  '##########',
];

const ALIGN_GLYPH: Record<Alignment, PixelMap> = {
  left: A_LEFT,
  center: A_CENTER,
  right: A_RIGHT,
  justify: A_JUSTIFY,
};

/* ----------------------------------------------------------------- doc ---- */

interface WriteDoc {
  html: string;
  ruler: RulerState;
  spacing: SpacingId;
}

const EMPTY_DOC: WriteDoc = {
  html: '',
  ruler: DEFAULT_RULER,
  spacing: 'single',
};

/** Ruler band height, and where inside it each stratum is drawn. */
const RULER_H = 20;
const RULE_Y = 14;

type MarkerDrag = { marker: RulerMarker } | { tab: number };

export default function ClassicWrite() {
  const [doc, setDoc, resetDoc, hydrated] = useAppSession<WriteDoc>(
    WRITE_SESSION_ID,
    EMPTY_DOC,
  );

  const [trackW, setTrackW] = useState(360);
  const [marks, setMarks] = useState({
    bold: false,
    italic: false,
    underline: false,
    align: 'left' as Alignment,
  });
  const [counts, setCounts] = useState({ words: 0, chars: 0 });
  const [confirmNew, setConfirmNew] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<MarkerDrag | null>(null);
  const loadedRef = useRef(false);

  const ruler = clampRuler(doc.ruler ?? DEFAULT_RULER, trackW);
  const spacing = doc.spacing ?? 'single';

  /* -------------------------------------------------------- measurement ---- */

  // The ruler has to be exactly as wide as the page's border box or every
  // number on it is a lie. Measuring the page rather than assuming a width also
  // means a scrollbar appearing, or the shell being resized, re-aligns the two
  // instead of quietly shearing them apart.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const measure = () => setTrackW(Math.round(editor.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(editor);
    return () => observer.disconnect();
  }, []);

  /* ---------------------------------------------------------- the document ---- */

  const refreshCounts = useCallback(() => {
    const text = editorRef.current?.innerText ?? '';
    setCounts({ words: countWords(text), chars: countChars(text) });
  }, []);

  const refreshMarks = useCallback(() => {
    const editor = editorRef.current;
    const sel = document.getSelection();
    if (!editor || !sel || sel.rangeCount === 0) return;
    if (!editor.contains(sel.anchorNode)) return;
    setMarks({
      bold: commandActive('bold'),
      italic: commandActive('italic'),
      underline: commandActive('underline'),
      align: currentAlignment(),
    });
  }, []);

  // Restore once. `hydrated` flips after the first render, and reapplying the
  // stored HTML on every autosave would yank the caret back to the top mid-word.
  useEffect(() => {
    if (!hydrated || loadedRef.current) return;
    loadedRef.current = true;
    preferCssStyling();
    const editor = editorRef.current;
    if (editor && doc.html) {
      editor.innerHTML = sanitizeStoredHtml(doc.html);
      refreshCounts();
    }
  }, [hydrated, doc.html, refreshCounts]);

  useEffect(() => {
    document.addEventListener('selectionchange', refreshMarks);
    return () => document.removeEventListener('selectionchange', refreshMarks);
  }, [refreshMarks]);

  const store = useCallback(() => {
    const html = editorRef.current?.innerHTML ?? '';
    setDoc((prev) => ({ ...prev, html }));
    refreshCounts();
  }, [setDoc, refreshCounts]);

  const focusEditor = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const sel = document.getSelection();
    if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) return;
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, []);

  const apply = useCallback(
    (command: string) => {
      focusEditor();
      runCommand(command);
      refreshMarks();
      store();
    },
    [focusEditor, refreshMarks, store],
  );

  /* ------------------------------------------------------------- the tab ---- */

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const editor = editorRef.current;
    const sel = document.getSelection();
    if (!editor || !sel || sel.rangeCount === 0) return;

    const origin = editor.getBoundingClientRect().left;
    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(true);
    const rects = range.getClientRects();
    // A collapsed range on an empty line reports no rects at all; fall back to
    // the block that contains it, whose left edge is where the caret is sitting.
    let caretLeft = rects.length > 0 ? rects[0].left : null;
    if (caretLeft === null) {
      const node = range.startContainer;
      const el = node.nodeType === 1 ? (node as Element) : node.parentElement;
      caretLeft = el?.getBoundingClientRect().left ?? origin;
    }

    const x = caretLeft - origin;
    const width = Math.max(2, Math.round(nextTabStop(x, ruler.tabs, ruler.rightIndent) - x));
    // An inline-block of a measured width is a tab: it advances the caret to a
    // position, which is what a tab stop means, rather than N of some character.
    runCommand('insertHTML', `<span style="display:inline-block;width:${width}px"></span>`);
    store();
  };

  /* -------------------------------------------------------------- ruler ---- */

  const xFromEvent = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.min(trackW, Math.max(0, clientX - rect.left));
  };

  // Deliberately not a curried `startMarker(drag)` factory: calling one of those
  // to build a prop happens *during* render, and writing a ref from a closure
  // created there is exactly what react-hooks/refs exists to stop.
  const onMarkerDown = (drag: MarkerDrag, e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = drag;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onMarkerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const x = xFromEvent(e.clientX);
    setDoc((prev) => {
      const base = clampRuler(prev.ruler ?? DEFAULT_RULER, trackW);
      const next =
        'marker' in drag
          ? moveMarker(base, drag.marker, x, trackW)
          : moveTab(base, drag.tab, x, trackW);
      return { ...prev, ruler: next };
    });
  };

  const onMarkerUp = (index: number | null, e: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (index === null || drag === null || !('tab' in drag)) return;
    // Dragged clear of the ruler: that is how you throw a tab stop away, and it
    // has been how you throw a tab stop away since 1984.
    const rect = trackRef.current?.getBoundingClientRect();
    if (rect && (e.clientY > rect.bottom + 12 || e.clientY < rect.top - 12)) {
      setDoc((prev) => ({
        ...prev,
        ruler: removeTab(clampRuler(prev.ruler ?? DEFAULT_RULER, trackW), index, trackW),
      }));
    }
  };

  const onTrackDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current) return;
    const x = xFromEvent(e.clientX);
    setDoc((prev) => ({
      ...prev,
      ruler: addTab(clampRuler(prev.ruler ?? DEFAULT_RULER, trackW), x, trackW),
    }));
  };

  /* --------------------------------------------------------------- new ---- */

  const startNew = () => {
    if (editorRef.current) editorRef.current.innerHTML = '';
    setConfirmNew(false);
    setCounts({ words: 0, chars: 0 });
    resetDoc();
  };

  /* ------------------------------------------------------------ render ---- */

  const ticks = rulerTicks(trackW);

  return (
    <div className={`${BIT_FONT} flex h-full flex-col bg-white text-black`}>
      {/* Font and style choices lived in the menus on the real thing, but the
          menu bar out there belongs to the Finder, so they are buttons here. */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-black p-1">
        <div role="group" aria-label="Character style" className="flex border border-black">
          <Toggle label="Bold" on={marks.bold} onPress={() => apply('bold')} testId="write-bold">
            <span className="font-bold">B</span>
          </Toggle>
          <Toggle label="Italic" on={marks.italic} onPress={() => apply('italic')} testId="write-italic">
            <span className="italic">I</span>
          </Toggle>
          <Toggle
            label="Underline"
            on={marks.underline}
            onPress={() => apply('underline')}
            testId="write-underline"
          >
            <span className="underline">U</span>
          </Toggle>
        </div>

        <div role="group" aria-label="Alignment" className="flex border border-black">
          {ALIGNMENTS.map((a) => (
            <Toggle
              key={a.id}
              label={a.label}
              on={marks.align === a.id}
              onPress={() => apply(a.command)}
              testId={`write-align-${a.id}`}
            >
              <PixelIcon map={ALIGN_GLYPH[a.id]} size={10} />
            </Toggle>
          ))}
        </div>

        <div role="group" aria-label="Line spacing" className="flex border border-black">
          {LINE_SPACINGS.map((s) => (
            <Toggle
              key={s.id}
              label={`${s.label} line spacing`}
              on={spacing === s.id}
              onPress={() => setDoc((prev) => ({ ...prev, spacing: s.id }))}
              testId={`write-spacing-${s.id}`}
            >
              {s.label}
            </Toggle>
          ))}
        </div>

        <div className="ml-auto">
          <BitButton onClick={() => setConfirmNew(true)}>New</BitButton>
        </div>
      </div>

      {/* Ruler. Same box model as the page below it — a 1px border around a
          track measured to the page's own width — so the two stay in register. */}
      <div className="shrink-0 px-2 pt-1 pb-1">
        <div className="inline-block border border-black bg-white" style={{ width: trackW + 2 }}>
          <div
            ref={trackRef}
            data-testid="write-ruler"
            onPointerDown={onTrackDown}
            className="relative cursor-crosshair touch-none"
            style={{ height: RULER_H }}
          >
            {ticks.map((t) => (
              <span
                key={t.x}
                aria-hidden="true"
                className="absolute w-px bg-black"
                style={{
                  left: Math.min(t.x, trackW - 1),
                  top: t.major ? RULE_Y - 6 : RULE_Y - 3,
                  height: t.major ? 6 : 3,
                }}
              />
            ))}
            <span
              aria-hidden="true"
              className="absolute left-0 h-px bg-black"
              style={{ top: RULE_Y, width: trackW }}
            />
            {ticks
              .filter((t) => t.label !== undefined && t.x < trackW - 10)
              .map((t) => (
                <span
                  key={`n${t.x}`}
                  aria-hidden="true"
                  className="absolute text-[8px] leading-none"
                  style={{ left: t.x + 2, top: 3 }}
                >
                  {t.label}
                </span>
              ))}

            <Marker
              label="First line indent"
              testId="write-marker-first"
              glyph={M_FIRST}
              x={ruler.firstLine}
              top={0}
              drag={{ marker: 'first' }}
              index={null}
              onDown={onMarkerDown}
              onMove={onMarkerMove}
              onUp={onMarkerUp}
            />
            <Marker
              label="Left indent"
              testId="write-marker-left"
              glyph={M_INDENT}
              x={ruler.leftIndent}
              top={RULER_H - 5}
              drag={{ marker: 'left' }}
              index={null}
              onDown={onMarkerDown}
              onMove={onMarkerMove}
              onUp={onMarkerUp}
            />
            <Marker
              label="Right indent"
              testId="write-marker-right"
              glyph={M_INDENT}
              x={ruler.rightIndent}
              top={RULER_H - 5}
              drag={{ marker: 'right' }}
              index={null}
              onDown={onMarkerDown}
              onMove={onMarkerMove}
              onUp={onMarkerUp}
            />
            {ruler.tabs.map((t, i) => (
              <Marker
                key={`tab-${t}`}
                label={`Tab stop at ${(t / 72).toFixed(2)} inches`}
                testId="write-tab"
                glyph={M_TAB}
                x={t}
                top={RULER_H - 5}
                drag={{ tab: i }}
                index={i}
                onDown={onMarkerDown}
                onMove={onMarkerMove}
                onUp={onMarkerUp}
              />
            ))}
          </div>
        </div>
      </div>

      {/* The page, sitting on the desktop's dither so it reads as a sheet of
          paper rather than a text box with a border round it. */}
      <div
        className="min-h-0 flex-1 overflow-auto px-2 pt-1 pb-3"
        style={BLACK_DITHER_STYLE}
      >
        <div className="border border-black bg-white">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label="Document"
            data-testid="write-editor"
            spellCheck={false}
            onInput={store}
            onKeyUp={refreshMarks}
            onKeyDown={onKeyDown}
            className="min-h-[200px] w-full text-[10px] outline-none"
            style={{
              ...indentStyle(ruler, trackW),
              lineHeight: spacingValue(spacing),
              paddingTop: 10,
              paddingBottom: 14,
            }}
          />
        </div>
      </div>

      <p
        aria-live="polite"
        className="shrink-0 truncate border-t border-black px-2 py-[3px] text-[8px] leading-[12px]"
      >
        {counts.words} words · {counts.chars} characters — drag the ruler markers;
        click the ruler for a tab, drag one off to lose it.
      </p>

      {confirmNew && (
        // BitDialog carries one button and it is the safe one, so Escape and
        // Return can only ever mean "keep what I wrote".
        <BitDialog
          title="New Document"
          icon={ICON_WRITE}
          confirmLabel="Cancel"
          onClose={() => setConfirmNew(false)}
        >
          <p>Throw this document away and start a blank one?</p>
          <div className="mt-3 flex justify-start">
            <BitButton data-testid="write-new-confirm" onClick={startNew}>
              Discard it
            </BitButton>
          </div>
        </BitDialog>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ sub-parts ---- */

function Toggle({
  label,
  on,
  onPress,
  testId,
  children,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  testId: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      data-testid={testId}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPress}
      className={[
        'flex h-[16px] min-w-[18px] cursor-default items-center justify-center border-r border-black px-1 last:border-r-0',
        'text-[10px] leading-none',
        'focus-visible:shadow-[inset_0_0_0_2px_#000] focus-visible:outline-none',
        on ? 'bg-black text-white' : 'bg-white text-black',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function Marker({
  label,
  testId,
  glyph,
  x,
  top,
  drag,
  index,
  onDown,
  onMove,
  onUp,
}: {
  label: string;
  testId: string;
  glyph: PixelMap;
  x: number;
  top: number;
  drag: MarkerDrag;
  /** Position in the tab list, or null for the three indent markers. */
  index: number | null;
  onDown: (drag: MarkerDrag, e: ReactPointerEvent<HTMLElement>) => void;
  onMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onUp: (index: number | null, e: ReactPointerEvent<HTMLElement>) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      data-testid={testId}
      onPointerDown={(e) => onDown(drag, e)}
      onPointerMove={onMove}
      onPointerUp={(e) => onUp(index, e)}
      onPointerCancel={(e) => onUp(index, e)}
      // A 7px glyph is not a touch target; the button is 15px wide with the
      // glyph centred inside it, which is the smallest that works with a thumb.
      className="absolute flex h-[8px] w-[15px] cursor-ew-resize touch-none items-start justify-center bg-transparent focus-visible:shadow-[0_0_0_1px_#000] focus-visible:outline-none"
      style={{ left: x - 7, top }}
    >
      <PixelIcon map={glyph} size={7} />
    </button>
  );
}
