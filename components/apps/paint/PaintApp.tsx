'use client';

/**
 * Paint — MacPaint, roughly.
 *
 * The canvas has a fixed logical size and is scaled up by CSS with
 * `image-rendering: pixelated`, which is both the right look and the simplest
 * correct pointer story: one backing store, one scale factor, no devicePixelRatio
 * maths to get wrong. See `toCanvasPoint`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppFrame,
  AppSidebar,
  Button,
  ConfirmDialog,
  Dialog,
  IconButton,
  Select,
  StatusBar,
  TextField,
  Toolbar,
  ToolbarSeparator,
  ToolbarSpacer,
} from '@/components/os/ui';
import { useAppSession } from '@/lib/os/persist';
import type { AppWindowProps } from '@/lib/os/types';
import { SELF_PORTRAIT } from '@/content/images';
import {
  drawImageUrl,
  drawPortrait,
  floodFill,
  normalizeRect,
  toCanvasPoint,
  toStorableDataUrl,
} from './canvasOps';
import { resolvePalette, TILE_BACKGROUND, type ResolvedSwatch } from './patterns';
import { ACTION_GLYPHS, TOOL_GLYPHS } from './icons';

const CANVAS_W = 480;
const CANVAS_H = 320;
const UNDO_LIMIT = 24;

type ToolId =
  | 'pencil'
  | 'brush'
  | 'eraser'
  | 'line'
  | 'rect'
  | 'rectFilled'
  | 'oval'
  | 'ovalFilled'
  | 'bucket'
  | 'text'
  | 'select';

const TOOLS: { id: ToolId; label: string }[] = [
  { id: 'pencil', label: 'Pencil' },
  { id: 'brush', label: 'Brush' },
  { id: 'eraser', label: 'Eraser' },
  { id: 'line', label: 'Line' },
  { id: 'rect', label: 'Rectangle' },
  { id: 'rectFilled', label: 'Filled rectangle' },
  { id: 'oval', label: 'Oval' },
  { id: 'ovalFilled', label: 'Filled oval' },
  { id: 'bucket', label: 'Paint bucket' },
  { id: 'text', label: 'Text' },
  { id: 'select', label: 'Select' },
];

const BRUSH_SIZES = [1, 2, 4, 8, 16];

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PaintSession {
  dataUrl: string | null;
}

interface Gesture {
  tool: ToolId;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  snapshot: ImageData | null;
  /** Set when dragging a lifted marquee selection around. */
  lifted?: { data: ImageData; originX: number; originY: number };
}

const EMPTY_SESSION: PaintSession = { dataUrl: null };

export default function PaintApp({ setTitle }: AppWindowProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const undoRef = useRef<string[]>([]);
  const restoredRef = useRef(false);
  const textFieldRef = useRef<HTMLDivElement | null>(null);

  const [session, setSession, resetSession, hydrated] = useAppSession<PaintSession>(
    'paint',
    EMPTY_SESSION,
  );
  // The palette reads CSS custom properties, so it can only be built in the
  // browser. This component is loaded with ssr:false, so the lazy initialiser
  // runs client-side; the guard is belt and braces.
  const [palette] = useState<ResolvedSwatch[]>(() =>
    typeof window === 'undefined' ? [] : resolvePalette(),
  );
  const [tool, setTool] = useState<ToolId>('pencil');
  const [brush, setBrush] = useState(2);
  const [swatchIndex, setSwatchIndex] = useState(0);
  const [undoDepth, setUndoDepth] = useState(0);
  const [selection, setSelection] = useState<Rect | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [textAt, setTextAt] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState('');
  const [box, setBox] = useState({ w: CANVAS_W, h: CANVAS_H });

  const swatch = palette[swatchIndex];

  const ctx = useCallback((): CanvasRenderingContext2D | null => {
    return canvasRef.current?.getContext('2d', { willReadFrequently: true }) ?? null;
  }, []);

  /* ------------------------------------------------------------ palette --- */

  useEffect(() => {
    setTitle('Untitled');
  }, [setTitle]);

  /* --------------------------------------------------------- fit to box --- */

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const availW = Math.max(48, el.clientWidth - 20);
      const availH = Math.max(32, el.clientHeight - 20);
      const scale = Math.min(availW / CANVAS_W, availH / CANVAS_H);
      setBox({
        w: Math.max(48, Math.floor(CANVAS_W * scale)),
        h: Math.max(32, Math.floor(CANVAS_H * scale)),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* --------------------------------------------------- restore / preload --- */

  useEffect(() => {
    const c = ctx();
    if (!c) return;
    c.fillStyle = TILE_BACKGROUND;
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }, [ctx]);

  useEffect(() => {
    if (!hydrated || restoredRef.current) return;
    restoredRef.current = true;
    const c = ctx();
    if (!c) return;
    c.fillStyle = TILE_BACKGROUND;
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
    if (session.dataUrl) {
      void drawImageUrl(c, session.dataUrl, CANVAS_W, CANVAS_H);
    } else {
      // First run: greet the visitor with the pixel self-portrait.
      void drawPortrait(c, SELF_PORTRAIT, CANVAS_W, CANVAS_H);
    }
    // restoredRef makes this a once-only effect; session.dataUrl is in the deps
    // only to satisfy the exhaustive-deps rule.
  }, [hydrated, session.dataUrl, ctx]);

  /* ------------------------------------------------------------ storage --- */

  const commit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSession({ dataUrl: toStorableDataUrl(canvas) });
  }, [setSession]);

  const pushUndo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    undoRef.current.push(canvas.toDataURL('image/png'));
    if (undoRef.current.length > UNDO_LIMIT) undoRef.current.shift();
    setUndoDepth(undoRef.current.length);
  }, []);

  const undo = useCallback(() => {
    const c = ctx();
    const url = undoRef.current.pop();
    setUndoDepth(undoRef.current.length);
    if (!c || !url) return;
    setSelection(null);
    c.fillStyle = TILE_BACKGROUND;
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
    void drawImageUrl(c, url, CANVAS_W, CANVAS_H).then(commit);
  }, [ctx, commit]);

  const clearAll = useCallback(() => {
    const c = ctx();
    if (!c) return;
    pushUndo();
    c.fillStyle = TILE_BACKGROUND;
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
    setSelection(null);
    resetSession();
    commit();
  }, [ctx, pushUndo, resetSession, commit]);

  /* ------------------------------------------------------------- paint ---- */

  const inkStyle = useCallback(
    (c: CanvasRenderingContext2D, erase: boolean): string | CanvasPattern => {
      if (erase || !swatch) return TILE_BACKGROUND;
      return c.createPattern(swatch.tileCanvas, 'repeat') ?? swatch.colour;
    },
    [swatch],
  );

  const applyStyle = useCallback(
    (c: CanvasRenderingContext2D, activeTool: ToolId) => {
      const erase = activeTool === 'eraser';
      const style = inkStyle(c, erase);
      c.strokeStyle = style;
      c.fillStyle = style;
      c.lineCap = activeTool === 'pencil' ? 'butt' : 'round';
      c.lineJoin = 'round';
      c.lineWidth = activeTool === 'pencil' ? 1 : activeTool === 'eraser' ? brush * 2 : brush;
      c.imageSmoothingEnabled = false;
    },
    [inkStyle, brush],
  );

  const drawShape = useCallback(
    (c: CanvasRenderingContext2D, g: Gesture, x: number, y: number) => {
      applyStyle(c, g.tool);
      switch (g.tool) {
        case 'line': {
          c.beginPath();
          c.moveTo(g.startX, g.startY);
          c.lineTo(x, y);
          c.stroke();
          break;
        }
        case 'rect':
        case 'rectFilled': {
          const r = normalizeRect(g.startX, g.startY, x, y, CANVAS_W, CANVAS_H);
          if (g.tool === 'rectFilled') c.fillRect(r.x, r.y, r.w, r.h);
          else c.strokeRect(r.x + 0.5, r.y + 0.5, Math.max(0, r.w - 1), Math.max(0, r.h - 1));
          break;
        }
        case 'oval':
        case 'ovalFilled': {
          const r = normalizeRect(g.startX, g.startY, x, y, CANVAS_W, CANVAS_H);
          c.beginPath();
          c.ellipse(r.x + r.w / 2, r.y + r.h / 2, Math.max(0.5, r.w / 2), Math.max(0.5, r.h / 2), 0, 0, Math.PI * 2);
          if (g.tool === 'ovalFilled') c.fill();
          else c.stroke();
          break;
        }
        default:
          break;
      }
    },
    [applyStyle],
  );

  const inSelection = (r: Rect | null, x: number, y: number) =>
    !!r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const canvas = canvasRef.current;
    const c = ctx();
    if (!canvas || !c) return;
    e.preventDefault();
    const { x, y } = toCanvasPoint(canvas, e.clientX, e.clientY);

    if (tool === 'text') {
      setTextValue('');
      setTextAt({ x, y });
      return;
    }

    if (tool === 'bucket') {
      if (!swatch) return;
      pushUndo();
      floodFill(c, CANVAS_W, CANVAS_H, x, y, swatch);
      commit();
      return;
    }

    canvas.setPointerCapture(e.pointerId);

    if (tool === 'select' && inSelection(selection, x, y) && selection) {
      // Lift the selected pixels so the drag moves them rather than smearing.
      pushUndo();
      const data = c.getImageData(selection.x, selection.y, selection.w, selection.h);
      c.fillStyle = TILE_BACKGROUND;
      c.fillRect(selection.x, selection.y, selection.w, selection.h);
      const snapshot = c.getImageData(0, 0, CANVAS_W, CANVAS_H);
      c.putImageData(data, selection.x, selection.y);
      gestureRef.current = {
        tool: 'select',
        startX: x,
        startY: y,
        lastX: x,
        lastY: y,
        snapshot,
        lifted: { data, originX: selection.x, originY: selection.y },
      };
      return;
    }

    if (tool === 'select') {
      setSelection(null);
      setMarquee({ x: Math.floor(x), y: Math.floor(y), w: 0, h: 0 });
      gestureRef.current = { tool, startX: x, startY: y, lastX: x, lastY: y, snapshot: null };
      return;
    }

    pushUndo();
    const snapshot = c.getImageData(0, 0, CANVAS_W, CANVAS_H);
    gestureRef.current = { tool, startX: x, startY: y, lastX: x, lastY: y, snapshot };

    if (tool === 'pencil' || tool === 'brush' || tool === 'eraser') {
      applyStyle(c, tool);
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + 0.01, y + 0.01);
      c.stroke();
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const c = ctx();
    if (!canvas || !c) return;
    const { x, y } = toCanvasPoint(canvas, e.clientX, e.clientY);
    setPointer({ x: Math.floor(x), y: Math.floor(y) });

    const g = gestureRef.current;
    if (!g) return;

    if (g.tool === 'select') {
      if (g.lifted && g.snapshot) {
        const dx = Math.round(x - g.startX);
        const dy = Math.round(y - g.startY);
        c.putImageData(g.snapshot, 0, 0);
        c.putImageData(g.lifted.data, g.lifted.originX + dx, g.lifted.originY + dy);
        setMarquee({
          x: g.lifted.originX + dx,
          y: g.lifted.originY + dy,
          w: g.lifted.data.width,
          h: g.lifted.data.height,
        });
      } else {
        setMarquee(normalizeRect(g.startX, g.startY, x, y, CANVAS_W, CANVAS_H));
      }
      g.lastX = x;
      g.lastY = y;
      return;
    }

    if (g.tool === 'pencil' || g.tool === 'brush' || g.tool === 'eraser') {
      applyStyle(c, g.tool);
      c.beginPath();
      c.moveTo(g.lastX, g.lastY);
      c.lineTo(x, y);
      c.stroke();
      g.lastX = x;
      g.lastY = y;
      return;
    }

    if (g.snapshot) c.putImageData(g.snapshot, 0, 0);
    drawShape(c, g, x, y);
    g.lastX = x;
    g.lastY = y;
  };

  const endGesture = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const g = gestureRef.current;
    if (canvas?.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    if (!g) return;
    gestureRef.current = null;

    if (g.tool === 'select') {
      setMarquee(null);
      if (g.lifted) {
        const dx = Math.round(g.lastX - g.startX);
        const dy = Math.round(g.lastY - g.startY);
        setSelection({
          x: g.lifted.originX + dx,
          y: g.lifted.originY + dy,
          w: g.lifted.data.width,
          h: g.lifted.data.height,
        });
        commit();
      } else {
        const r = normalizeRect(g.startX, g.startY, g.lastX, g.lastY, CANVAS_W, CANVAS_H);
        setSelection(r.w > 1 && r.h > 1 ? r : null);
      }
      return;
    }
    commit();
  };

  /* -------------------------------------------------------------- text ---- */

  // Dialog focuses itself in its own effect, which runs after its children's.
  // A frame later is the simplest way to hand the caret to the field instead.
  useEffect(() => {
    if (!textAt) return;
    const raf = requestAnimationFrame(() =>
      textFieldRef.current?.querySelector('input')?.focus(),
    );
    return () => cancelAnimationFrame(raf);
  }, [textAt]);

  const placeText = () => {
    const c = ctx();
    const at = textAt;
    if (!c || !at || textValue.trim().length === 0) {
      setTextAt(null);
      return;
    }
    pushUndo();
    const px = Math.max(9, brush * 6);
    c.font = `${px}px "Chicago", "Geneva", monospace`;
    c.textBaseline = 'alphabetic';
    c.fillStyle = inkStyle(c, false);
    c.fillText(textValue, at.x, at.y);
    setTextAt(null);
    setTextValue('');
    commit();
  };

  /* ---------------------------------------------------------- keyboard ---- */

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
      return;
    }
    if (e.key === 'Escape') {
      setSelection(null);
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selection) {
      e.preventDefault();
      const c = ctx();
      if (!c) return;
      pushUndo();
      c.fillStyle = TILE_BACKGROUND;
      c.fillRect(selection.x, selection.y, selection.w, selection.h);
      setSelection(null);
      commit();
    }
  };

  /* ------------------------------------------------------------ export ---- */

  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'untitled.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  /* ------------------------------------------------------------ render ---- */

  const overlay = marquee ?? selection;
  const overlayStyle = useMemo(() => {
    if (!overlay) return undefined;
    return {
      left: `${(overlay.x / CANVAS_W) * 100}%`,
      top: `${(overlay.y / CANVAS_H) * 100}%`,
      width: `${(overlay.w / CANVAS_W) * 100}%`,
      height: `${(overlay.h / CANVAS_H) * 100}%`,
    };
  }, [overlay]);

  const activeSwatchLabel = swatch?.label ?? '—';

  return (
    <AppFrame
      scroll={false}
      toolbar={
        <Toolbar className="flex-wrap">
          <IconButton label="Undo" disabled={undoDepth === 0} onClick={undo}>
            {ACTION_GLYPHS.undo}
          </IconButton>
          <ToolbarSeparator />
          <Button onClick={() => setConfirmClear(true)}>Clear</Button>
          <Button onClick={exportPng}>Export PNG</Button>
          <ToolbarSpacer />
          <Select
            aria-label="Brush size"
            value={brush}
            onChange={(e) => setBrush(Number(e.target.value))}
          >
            {BRUSH_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} px
              </option>
            ))}
          </Select>
        </Toolbar>
      }
      sidebar={
        <AppSidebar width={104}>
          <div className="grid grid-cols-3 gap-[3px]">
            {TOOLS.map((t) => (
              <IconButton
                key={t.id}
                label={t.label}
                active={tool === t.id}
                onClick={() => {
                  setTool(t.id);
                  if (t.id !== 'select') setSelection(null);
                }}
              >
                {TOOL_GLYPHS[t.id]}
              </IconButton>
            ))}
          </div>

          <div className="my-2 h-px bg-os-chrome-dark" />

          <div className="grid grid-cols-3 gap-[3px]">
            {palette.map((s, i) => (
              <button
                key={s.id}
                type="button"
                title={s.label}
                aria-label={s.label}
                aria-pressed={swatchIndex === i}
                onClick={() => setSwatchIndex(i)}
                className={`h-[26px] w-[26px] shrink-0 rounded-[3px] ${
                  swatchIndex === i ? 'os-bevel-in' : 'os-bevel'
                }`}
              >
                <span
                  aria-hidden
                  className="pixelated block h-full w-full"
                  style={{
                    backgroundImage: `url(${s.preview})`,
                    backgroundSize: '16px 16px',
                    backgroundRepeat: 'repeat',
                  }}
                />
              </button>
            ))}
          </div>
        </AppSidebar>
      }
      status={
        <StatusBar>
          <span>{TOOLS.find((t) => t.id === tool)?.label}</span>
          <span className="text-os-ink-soft">{activeSwatchLabel}</span>
          <ToolbarSpacer />
          {selection && (
            <span className="text-os-ink-soft">
              {selection.w}×{selection.h}
            </span>
          )}
          <span className="text-os-ink-soft">
            {pointer ? `${pointer.x}, ${pointer.y}` : `${CANVAS_W}×${CANVAS_H}`}
          </span>
        </StatusBar>
      }
    >
      <div
        ref={stageRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="flex h-full w-full items-center justify-center overflow-hidden bg-os-well p-2 outline-none"
      >
        <div className="relative" style={{ width: box.w, height: box.h }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endGesture}
            onPointerCancel={endGesture}
            onPointerLeave={() => setPointer(null)}
            className="pixelated block border border-os-ink bg-white"
            style={{
              width: box.w,
              height: box.h,
              touchAction: 'none',
              cursor: tool === 'text' ? 'text' : 'crosshair',
            }}
          />
          {overlay && overlay.w > 0 && overlay.h > 0 && (
            <div
              aria-hidden
              className="pointer-events-none absolute border border-dashed border-os-ink"
              style={overlayStyle}
            />
          )}
        </div>
      </div>

      {confirmClear && (
        <ConfirmDialog
          title="Paint"
          message="Erase the whole canvas? This cannot be undone after you close the window."
          confirmLabel="Erase"
          onConfirm={() => {
            clearAll();
            setConfirmClear(false);
          }}
          onCancel={() => setConfirmClear(false)}
        />
      )}

      {textAt && (
        <Dialog
          title="Text"
          onDismiss={() => setTextAt(null)}
          actions={
            <>
              <Button onClick={() => setTextAt(null)}>Cancel</Button>
              <Button isDefault onClick={placeText}>
                Place
              </Button>
            </>
          }
        >
          <div ref={textFieldRef}>
            <TextField
              className="w-full"
              value={textValue}
              placeholder="Type something"
              onChange={(e) => setTextValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') placeText();
              }}
            />
          </div>
        </Dialog>
      )}
    </AppFrame>
  );
}
