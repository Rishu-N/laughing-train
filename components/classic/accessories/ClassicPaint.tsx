'use client';

/**
 * BitPaint — the 1984 shell's bitmap editor.
 *
 * OWNER: Classic Boot agent.
 *
 * An application, not a desk accessory: it is launched from the startup disk
 * and deliberately absent from the mark menu (catalog.ts → APPLICATIONS).
 *
 * The layout is the one the 1984 machine's paint program taught everybody: a
 * vertical tool palette down the left, a pattern palette along the bottom, and
 * the line-weight well in the bottom-left corner. The selected tool inverts,
 * which is the only way a one-bit display could ever show state.
 *
 * All of the raster work lives in lib/classic/paint.ts as pure functions over a
 * Uint8Array frame buffer. This file is a view: it owns pointer plumbing, the
 * undo stack's plumbing, and nothing that draws a pixel. That division is what
 * keeps a flood fill something you can reason about rather than something
 * tangled up in a canvas context.
 *
 * Colour is not a compromise here and never was — the paint program that
 * shipped with Windows 1.0 in 1985 was monochrome too.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { ICON_PAINT, type PixelMap } from '@/components/classic/icons';
import { BIT_FONT, BitButton } from '@/components/classic/ui/Bit';
import BitDialog from '@/components/classic/ui/BitDialog';
import PixelIcon from '@/components/classic/ui/PixelIcon';
import { useAppSession } from '@/lib/os/persist';
import {
  BRUSH_SHAPES,
  EMPTY_UNDO,
  LINE_WEIGHTS,
  PAINT_HEIGHT,
  PAINT_PALETTE,
  PAINT_SESSION_ID,
  PAINT_WIDTH,
  WHITE_INK,
  applyMask,
  clientToPixel,
  cloneBitmap,
  copyRegion,
  createBitmap,
  decodeBitmap,
  encodeBitmap,
  eraseRegion,
  fillOval,
  fillRect,
  floodFill,
  maskFromAlpha,
  normalizeRect,
  outlineOval,
  outlineRect,
  pasteRegion,
  pencilValue,
  popFrame,
  pushFrame,
  stamp,
  strokeLine,
  strokePencil,
  toRGBA,
  type Bitmap,
  type BrushShape,
  type Rect,
  type Region,
  type ToolId,
  type UndoStack,
} from '@/lib/classic/paint';

/* --------------------------------------------------------------- glyphs ---- */

/**
 * 12×12 tool glyphs, in the same '#'-is-a-pixel notation as icons.ts. They live
 * here rather than in icons.ts because nothing outside this window has any use
 * for a picture of a paint bucket.
 */
const G_PENCIL: PixelMap = [
  '............',
  '........###.',
  '.......####.',
  '......####..',
  '.....####...',
  '....####....',
  '...####.....',
  '..####......',
  '.####.......',
  '.###........',
  '.#..........',
  '............',
];

const G_BRUSH: PixelMap = [
  '............',
  '.........##.',
  '........##..',
  '.......##...',
  '......##....',
  '.....###....',
  '....#####...',
  '...#####....',
  '...####.....',
  '..####......',
  '..###.......',
  '............',
];

const G_ERASER: PixelMap = [
  '............',
  '............',
  '.....#####..',
  '....######..',
  '...######...',
  '..######....',
  '.######.....',
  '.#####......',
  '.####.......',
  '............',
  '............',
  '............',
];

const G_LINE: PixelMap = [
  '............',
  '.........##.',
  '.........##.',
  '........#...',
  '.......#....',
  '......#.....',
  '.....#......',
  '....#.......',
  '...#........',
  '.##.........',
  '.##.........',
  '............',
];

const G_RECT: PixelMap = [
  '............',
  '............',
  '.##########.',
  '.#........#.',
  '.#........#.',
  '.#........#.',
  '.#........#.',
  '.#........#.',
  '.##########.',
  '............',
  '............',
  '............',
];

const G_RECT_FILLED: PixelMap = [
  '............',
  '............',
  '.##########.',
  '.##########.',
  '.##########.',
  '.##########.',
  '.##########.',
  '.##########.',
  '.##########.',
  '............',
  '............',
  '............',
];

const G_OVAL: PixelMap = [
  '............',
  '...######...',
  '..#......#..',
  '.#........#.',
  '.#........#.',
  '.#........#.',
  '.#........#.',
  '..#......#..',
  '...######...',
  '............',
  '............',
  '............',
];

const G_OVAL_FILLED: PixelMap = [
  '............',
  '...######...',
  '..########..',
  '.##########.',
  '.##########.',
  '.##########.',
  '.##########.',
  '..########..',
  '...######...',
  '............',
  '............',
  '............',
];

const G_BUCKET: PixelMap = [
  '............',
  '.......#....',
  '......###...',
  '.......#....',
  '............',
  '..######....',
  '..#....#....',
  '..#....#....',
  '...#..#.....',
  '....##......',
  '............',
  '............',
];

const G_MARQUEE: PixelMap = [
  '............',
  '............',
  '.##.##.##.#.',
  '.#........#.',
  '.#........#.',
  '..........#.',
  '.#........#.',
  '.#..........',
  '.##.##.##.#.',
  '............',
  '............',
  '............',
];

const G_TEXT: PixelMap = [
  '............',
  '............',
  '....##......',
  '....##......',
  '...####.....',
  '...#..#.....',
  '..######....',
  '..#....#....',
  '.##....##...',
  '............',
  '............',
  '............',
];

interface ToolDef {
  id: ToolId;
  label: string;
  glyph: PixelMap;
  /** One line in the status bar, so no tool is a mystery box. */
  hint: string;
}

const TOOLS: readonly ToolDef[] = [
  { id: 'pencil', label: 'Pencil', glyph: G_PENCIL, hint: 'Draws black. Starting on black rubs out instead.' },
  { id: 'brush', label: 'Brush', glyph: G_BRUSH, hint: 'Paints with the selected pattern and nib.' },
  { id: 'eraser', label: 'Eraser', glyph: G_ERASER, hint: 'Wipes back to paper.' },
  { id: 'line', label: 'Line', glyph: G_LINE, hint: 'Drag for a straight line.' },
  { id: 'rect', label: 'Rectangle', glyph: G_RECT, hint: 'Drag out a hollow box.' },
  { id: 'rect-filled', label: 'Filled rectangle', glyph: G_RECT_FILLED, hint: 'Drag out a box filled with the pattern.' },
  { id: 'oval', label: 'Oval', glyph: G_OVAL, hint: 'Drag out a hollow oval.' },
  { id: 'oval-filled', label: 'Filled oval', glyph: G_OVAL_FILLED, hint: 'Drag out an oval filled with the pattern.' },
  { id: 'bucket', label: 'Paint bucket', glyph: G_BUCKET, hint: 'Click an area to flood it with the pattern.' },
  { id: 'marquee', label: 'Selection', glyph: G_MARQUEE, hint: 'Drag a box, then drag inside it to move the pixels.' },
  { id: 'text', label: 'Text', glyph: G_TEXT, hint: 'Click, then type. Return sets it, Escape drops it.' },
];

/** Type size follows the line-weight well — a thicker nib writes bigger. */
const TEXT_SIZES = [8, 12, 16, 24];

interface PaintDoc {
  bits: string;
}

const EMPTY_DOC: PaintDoc = { bits: '' };

/* ------------------------------------------------------------- component ---- */

type Drag =
  | { kind: 'freehand'; last: { x: number; y: number }; ink: number }
  | { kind: 'shape'; start: { x: number; y: number } }
  | { kind: 'select'; start: { x: number; y: number } }
  | { kind: 'move'; grab: { x: number; y: number }; origin: Rect; region: Region };

export default function ClassicPaint() {
  const [tool, setTool] = useState<ToolId>('pencil');
  const [patternIndex, setPatternIndex] = useState(0);
  const [weightIndex, setWeightIndex] = useState(0);
  const [brushIndex, setBrushIndex] = useState(0);
  const [undoDepth, setUndoDepth] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const [textAt, setTextAt] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState('');

  const [doc, setDoc, resetDoc, hydrated] = useAppSession<PaintDoc>(
    PAINT_SESSION_ID,
    EMPTY_DOC,
  );

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  /** The document. A ref, not state: 64,000 bytes has no business in a render. */
  const bmpRef = useRef<Bitmap>(createBitmap());
  /** Pre-gesture copy, so a rubber-banded shape can be redrawn from scratch. */
  const baseRef = useRef<Bitmap>(createBitmap());
  const undoRef = useRef<UndoStack>(EMPTY_UNDO);
  const dragRef = useRef<Drag | null>(null);
  const selectionRef = useRef<Rect | null>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const textWidthRef = useRef(0);
  const loadedRef = useRef(false);
  /** Resolved at runtime: next/font generates the family name, we can't spell it. */
  const fontRef = useRef('monospace');

  const pattern = PAINT_PALETTE[patternIndex] ?? PAINT_PALETTE[0];
  const weight = LINE_WEIGHTS[weightIndex] ?? 1;
  const brush: BrushShape = BRUSH_SHAPES[brushIndex] ?? 'round';
  const textSize = TEXT_SIZES[weightIndex] ?? 12;
  const activeTool = useMemo(() => TOOLS.find((t) => t.id === tool), [tool]);

  /* --------------------------------------------------------------- view ---- */

  const repaint = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(
      new ImageData(toRGBA(bmpRef.current), PAINT_WIDTH, PAINT_HEIGHT),
      0,
      0,
    );

    // The marquee outline and the text caret are chrome, not document. They are
    // drawn over the blit so they can never be saved into the bitmap by mistake.
    const sel = selectionRef.current;
    if (sel) {
      for (let i = 0; i < sel.w; i += 1) {
        ctx.fillStyle = (i >> 1) % 2 === 0 ? '#000' : '#fff';
        ctx.fillRect(sel.x + i, sel.y, 1, 1);
        ctx.fillRect(sel.x + i, sel.y + sel.h - 1, 1, 1);
      }
      for (let i = 0; i < sel.h; i += 1) {
        ctx.fillStyle = (i >> 1) % 2 === 0 ? '#000' : '#fff';
        ctx.fillRect(sel.x, sel.y + i, 1, 1);
        ctx.fillRect(sel.x + sel.w - 1, sel.y + i, 1, 1);
      }
    }
    if (textAt) {
      ctx.fillStyle = '#000';
      ctx.fillRect(textAt.x + textWidthRef.current, textAt.y - textSize + 2, 1, textSize);
    }
  }, [textAt, textSize]);

  const save = useCallback(() => {
    setDoc({ bits: encodeBitmap(bmpRef.current) });
  }, [setDoc]);

  const snapshot = useCallback(() => {
    undoRef.current = pushFrame(undoRef.current, bmpRef.current);
    setUndoDepth(undoRef.current.frames.length);
  }, []);

  const undo = useCallback(() => {
    const popped = popFrame(undoRef.current);
    if (!popped) return;
    undoRef.current = popped.stack;
    bmpRef.current = popped.bitmap;
    selectionRef.current = null;
    setUndoDepth(popped.stack.frames.length);
    repaint();
    save();
  }, [repaint, save]);

  /* ---------------------------------------------------------- lifecycle ---- */

  useEffect(() => {
    offscreenRef.current = document.createElement('canvas');
    offscreenRef.current.width = PAINT_WIDTH;
    offscreenRef.current.height = PAINT_HEIGHT;
    if (rootRef.current) {
      fontRef.current = window.getComputedStyle(rootRef.current).fontFamily || 'monospace';
    }
  }, []);

  // Restore exactly once. `hydrated` flips after the first paint, and without
  // the guard a later autosave would keep reloading the canvas underneath the
  // stroke being drawn on it.
  useEffect(() => {
    if (!hydrated || loadedRef.current) return;
    loadedRef.current = true;
    const restored = doc.bits ? decodeBitmap(doc.bits) : null;
    if (restored) bmpRef.current = restored;
    repaint();
  }, [hydrated, doc.bits, repaint]);

  useEffect(() => {
    repaint();
  }, [repaint]);

  // Switching tools drops the marquee, the way picking up a different tool
  // always did.
  useEffect(() => {
    selectionRef.current = null;
    repaint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  /* --------------------------------------------------------------- text ---- */

  const renderText = useCallback(
    (value: string) => {
      const next = cloneBitmap(baseRef.current);
      const off = offscreenRef.current;
      const octx = off?.getContext('2d', { willReadFrequently: true });
      if (textAt && octx && value !== '') {
        octx.clearRect(0, 0, PAINT_WIDTH, PAINT_HEIGHT);
        octx.fillStyle = '#000';
        octx.textBaseline = 'alphabetic';
        octx.font = `${textSize}px ${fontRef.current}`;
        octx.fillText(value, textAt.x, textAt.y);
        textWidthRef.current = Math.round(octx.measureText(value).width);
        const { data } = octx.getImageData(0, 0, PAINT_WIDTH, PAINT_HEIGHT);
        applyMask(next, maskFromAlpha(data), pattern);
      } else {
        textWidthRef.current = 0;
      }
      bmpRef.current = next;
      repaint();
    },
    [textAt, textSize, pattern, repaint],
  );

  useEffect(() => {
    if (!textAt) return;
    renderText(textValue);
  }, [textAt, textValue, renderText]);

  const commitText = useCallback(() => {
    if (!textAt) return;
    if (textValue !== '') {
      // The undo frame is the canvas as it was before the caret was placed, so
      // one Undo takes the whole word back rather than one letter.
      undoRef.current = pushFrame(undoRef.current, baseRef.current);
      setUndoDepth(undoRef.current.frames.length);
      save();
    }
    setTextAt(null);
    setTextValue('');
    textWidthRef.current = 0;
  }, [textAt, textValue, save]);

  const cancelText = useCallback(() => {
    bmpRef.current = cloneBitmap(baseRef.current);
    setTextAt(null);
    setTextValue('');
    textWidthRef.current = 0;
    repaint();
  }, [repaint]);

  /* ------------------------------------------------------------ pointer ---- */

  const pointAt = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return clientToPixel(rect, e.clientX, e.clientY);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const p = pointAt(e);

    if (tool === 'text') {
      // A live caret in the canvas, not a dialog. Everything typed re-renders
      // from the pre-caret snapshot, so the preview is the committed result.
      commitText();
      baseRef.current = cloneBitmap(bmpRef.current);
      setTextAt(p);
      setTextValue('');
      window.setTimeout(() => textInputRef.current?.focus({ preventScroll: true }), 0);
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);

    if (tool === 'bucket') {
      snapshot();
      floodFill(bmpRef.current, p.x, p.y, pattern);
      repaint();
      save();
      return;
    }

    if (tool === 'marquee') {
      const sel = selectionRef.current;
      const inside =
        sel !== null &&
        p.x >= sel.x &&
        p.x < sel.x + sel.w &&
        p.y >= sel.y &&
        p.y < sel.y + sel.h;
      if (inside && sel) {
        snapshot();
        const region = copyRegion(bmpRef.current, sel);
        baseRef.current = cloneBitmap(bmpRef.current);
        eraseRegion(baseRef.current, sel);
        dragRef.current = { kind: 'move', grab: p, origin: sel, region };
      } else {
        selectionRef.current = null;
        dragRef.current = { kind: 'select', start: p };
        repaint();
      }
      return;
    }

    snapshot();

    if (tool === 'pencil') {
      const value = pencilValue(bmpRef.current, p.x, p.y);
      strokePencil(bmpRef.current, p.x, p.y, p.x, p.y, value);
      dragRef.current = { kind: 'freehand', last: p, ink: value };
      repaint();
      return;
    }

    if (tool === 'brush' || tool === 'eraser') {
      const nib = tool === 'eraser' ? WHITE_INK : pattern;
      const size = tool === 'eraser' ? weight * 3 + 2 : weight;
      const shape: BrushShape = tool === 'eraser' ? 'square' : brush;
      stamp(bmpRef.current, p.x, p.y, shape, size, nib);
      dragRef.current = { kind: 'freehand', last: p, ink: 1 };
      repaint();
      return;
    }

    baseRef.current = cloneBitmap(bmpRef.current);
    dragRef.current = { kind: 'shape', start: p };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const p = pointAt(e);

    if (drag.kind === 'freehand') {
      if (tool === 'pencil') {
        strokePencil(bmpRef.current, drag.last.x, drag.last.y, p.x, p.y, drag.ink);
      } else {
        const nib = tool === 'eraser' ? WHITE_INK : pattern;
        const size = tool === 'eraser' ? weight * 3 + 2 : weight;
        const shape: BrushShape = tool === 'eraser' ? 'square' : brush;
        strokeLine(bmpRef.current, drag.last.x, drag.last.y, p.x, p.y, shape, size, nib);
      }
      drag.last = p;
      repaint();
      return;
    }

    if (drag.kind === 'select') {
      selectionRef.current = normalizeRect(drag.start.x, drag.start.y, p.x, p.y);
      repaint();
      return;
    }

    if (drag.kind === 'move') {
      const dx = p.x - drag.grab.x;
      const dy = p.y - drag.grab.y;
      bmpRef.current = cloneBitmap(baseRef.current);
      pasteRegion(bmpRef.current, drag.region, drag.origin.x + dx, drag.origin.y + dy);
      selectionRef.current = {
        x: drag.origin.x + dx,
        y: drag.origin.y + dy,
        w: drag.origin.w,
        h: drag.origin.h,
      };
      repaint();
      return;
    }

    // Rubber band: redraw the shape from the pre-drag copy every move, which is
    // the only way to preview a shape that has not been committed yet.
    const rect = normalizeRect(drag.start.x, drag.start.y, p.x, p.y);
    bmpRef.current = cloneBitmap(baseRef.current);
    switch (tool) {
      case 'line':
        strokeLine(bmpRef.current, drag.start.x, drag.start.y, p.x, p.y, 'square', weight, pattern);
        break;
      case 'rect':
        outlineRect(bmpRef.current, rect, weight, pattern);
        break;
      case 'rect-filled':
        fillRect(bmpRef.current, rect, pattern);
        break;
      case 'oval':
        outlineOval(bmpRef.current, rect, weight, pattern);
        break;
      case 'oval-filled':
        fillOval(bmpRef.current, rect, pattern);
        break;
      default:
        break;
    }
    repaint();
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const wasSelect = dragRef.current.kind === 'select';
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    // A selection changes nothing on the canvas, so there is nothing to store.
    if (!wasSelect) save();
  };

  /* -------------------------------------------------------------- window ---- */

  const clearAll = () => {
    snapshot();
    bmpRef.current = createBitmap();
    selectionRef.current = null;
    setConfirmClear(false);
    repaint();
    resetDoc();
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.stopPropagation();
      undo();
    }
  };

  return (
    <div
      ref={rootRef}
      onKeyDown={onKeyDown}
      className={`${BIT_FONT} flex h-full flex-col bg-white text-black select-none`}
    >
      <div className="flex min-h-0 flex-1">
        {/* Tool palette. Two columns, exactly as the original stacked them. */}
        <div
          role="toolbar"
          aria-label="Tools"
          aria-orientation="vertical"
          className="grid shrink-0 grid-cols-2 content-start"
        >
          {TOOLS.map((t) => {
            const on = t.id === tool;
            return (
              <button
                key={t.id}
                type="button"
                aria-label={t.label}
                aria-pressed={on}
                data-testid={`paint-tool-${t.id}`}
                onClick={() => setTool(t.id)}
                className={[
                  'flex h-[20px] w-[20px] cursor-default items-center justify-center border-r border-b border-black',
                  'focus-visible:shadow-[inset_0_0_0_2px_#000] focus-visible:outline-none',
                  on ? 'bg-black text-white' : 'bg-white text-black',
                ].join(' ')}
              >
                <PixelIcon map={t.glyph} size={12} />
              </button>
            );
          })}
        </div>

        {/* The canvas is a fixed 320×200 backing store stretched by CSS, so the
            pointer maths below is one scale factor and no device-pixel-ratio. */}
        <div className="relative min-w-0 flex-1 overflow-auto bg-white p-[3px]">
          {/* The frame sits on the wrapper, never on the canvas: a border would
              land inside the canvas's own bounding rect and quietly skew the
              client-to-pixel mapping by a border's width. */}
          <div className="border border-black">
            <canvas
              ref={canvasRef}
              width={PAINT_WIDTH}
              height={PAINT_HEIGHT}
              data-testid="paint-canvas"
              aria-label="Drawing canvas"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="block h-auto w-full touch-none"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
          {textAt && (
            // Off-screen but focused, so a phone raises its keyboard and the
            // caret drawn on the canvas is the one the visitor is typing into.
            <input
              ref={textInputRef}
              value={textValue}
              aria-label="Text to place on the canvas"
              data-testid="paint-text-entry"
              onChange={(e) => setTextValue(e.target.value)}
              onBlur={commitText}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.key === 'Enter') commitText();
                  else cancelText();
                }
              }}
              className="absolute top-0 left-0 h-[1px] w-[1px] border-0 p-0 opacity-0"
            />
          )}
        </div>
      </div>

      {/* Weights and nibs bottom-left, patterns along the bottom. Wraps at phone
          width rather than scrolling, so nothing here is ever out of reach. */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-t border-black p-1">
        <Well label="Line weight">
          {LINE_WEIGHTS.map((w, i) => (
            <button
              key={w}
              type="button"
              aria-label={`${w} pixel line`}
              aria-pressed={i === weightIndex}
              data-testid={`paint-weight-${w}`}
              onClick={() => setWeightIndex(i)}
              className={[
                'flex h-[16px] w-[16px] cursor-default items-center justify-center border-r border-black last:border-r-0',
                'focus-visible:shadow-[inset_0_0_0_2px_#000] focus-visible:outline-none',
                i === weightIndex ? 'bg-black' : 'bg-white',
              ].join(' ')}
            >
              <span
                style={{ height: w, width: 10 }}
                className={i === weightIndex ? 'bg-white' : 'bg-black'}
              />
            </button>
          ))}
        </Well>

        <Well label="Brush shape">
          {BRUSH_SHAPES.map((shape, i) => (
            <button
              key={shape}
              type="button"
              aria-label={`${shape} brush`}
              aria-pressed={i === brushIndex}
              onClick={() => setBrushIndex(i)}
              className={[
                'flex h-[16px] w-[16px] cursor-default items-center justify-center border-r border-black last:border-r-0',
                'focus-visible:shadow-[inset_0_0_0_2px_#000] focus-visible:outline-none',
                i === brushIndex ? 'bg-black' : 'bg-white',
              ].join(' ')}
            >
              <span
                className={i === brushIndex ? 'bg-white' : 'bg-black'}
                style={
                  shape === 'round'
                    ? { height: 8, width: 8, borderRadius: 0, clipPath: 'circle(50%)' }
                    : shape === 'square'
                      ? { height: 8, width: 8 }
                      : { height: 10, width: 2, transform: 'rotate(45deg)' }
                }
              />
            </button>
          ))}
        </Well>

        <Well label="Pattern">
          {PAINT_PALETTE.map((p, i) => (
            <button
              key={p.id}
              type="button"
              aria-label={p.label}
              aria-pressed={i === patternIndex}
              data-testid={`paint-pattern-${p.id}`}
              onClick={() => setPatternIndex(i)}
              className={[
                'h-[16px] w-[16px] cursor-default border-r border-black last:border-r-0',
                'focus-visible:shadow-[inset_0_0_0_2px_#000] focus-visible:outline-none',
                i === patternIndex ? 'shadow-[inset_0_0_0_2px_#000,inset_0_0_0_3px_#fff]' : '',
              ].join(' ')}
              style={p.style}
            />
          ))}
        </Well>

        <div className="ml-auto flex items-center gap-1">
          <BitButton onClick={undo} disabled={undoDepth === 0}>
            Undo
          </BitButton>
          <BitButton onClick={() => setConfirmClear(true)}>Clear</BitButton>
        </div>
      </div>

      <p className="shrink-0 truncate border-t border-black px-2 py-[3px] text-[8px] leading-[12px]">
        {activeTool?.label}: {activeTool?.hint}
      </p>

      {confirmClear && (
        // BitDialog carries exactly one button, and it is the safe one. The
        // destructive choice sits in the body so Escape and Return can only
        // ever mean "leave my drawing alone".
        <BitDialog
          title="Clear Drawing"
          icon={ICON_PAINT}
          confirmLabel="Cancel"
          onClose={() => setConfirmClear(false)}
        >
          <p>Throw the whole drawing away and start on clean paper?</p>
          <div className="mt-3 flex justify-start">
            <BitButton onClick={clearAll}>Erase it</BitButton>
          </div>
        </BitDialog>
      )}
    </div>
  );
}

/** A boxed group of picker cells — the "wells" along the bottom of the window. */
function Well({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex shrink-0 border border-black"
    >
      {children}
    </div>
  );
}
