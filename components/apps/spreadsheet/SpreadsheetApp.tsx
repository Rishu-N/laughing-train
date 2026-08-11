'use client';

/**
 * Spreadsheet — 26 columns by 50 rows, a formula bar, and a real parser.
 *
 * Formula evaluation lives in ./formula: tokenizer + recursive-descent parser,
 * no eval, with circular-reference detection.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppFrame,
  Button,
  ConfirmDialog,
  StatusBar,
  TextField,
  Toolbar,
  ToolbarSeparator,
  ToolbarSpacer,
} from '@/components/os/ui';
import { useAppSession } from '@/lib/os/persist';
import type { AppWindowProps } from '@/lib/os/types';
import {
  COLUMN_COUNT,
  ROW_COUNT,
  alignmentFor,
  cellId,
  columnLabel,
  createSheet,
  formatValue,
  type CellMap,
} from './formula';

const COL_WIDTH = 80;
const ROW_HEIGHT = 20;
const HEADER_WIDTH = 40;

interface SheetSession {
  cells: CellMap;
}

const EMPTY: SheetSession = { cells: {} };

interface Selection {
  col: number;
  row: number;
}

interface Editing extends Selection {
  value: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export default function SpreadsheetApp({ setTitle }: AppWindowProps) {
  const [doc, setDoc, reset] = useAppSession<SheetSession>('spreadsheet', EMPTY);
  const [sel, setSel] = useState<Selection>({ col: 0, row: 0 });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef<HTMLDivElement | null>(null);
  const cellInputRef = useRef<HTMLInputElement | null>(null);

  const cells = doc.cells;
  const sheet = useMemo(() => createSheet(cells), [cells]);

  const selId = cellId(sel.col, sel.row);
  const selRaw = cells[selId] ?? '';
  const selValue = sheet.valueOf(selId);

  useEffect(() => {
    setTitle('Untitled');
  }, [setTitle]);

  /* Keep the selected cell on screen when the keyboard moves it. */
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [sel]);

  useEffect(() => {
    if (editing) cellInputRef.current?.focus();
  }, [editing]);

  const setCell = useCallback(
    (id: string, raw: string) => {
      setDoc((d) => {
        const next: CellMap = { ...d.cells };
        if (raw.trim() === '') delete next[id];
        else next[id] = raw;
        return { cells: next };
      });
    },
    [setDoc],
  );

  const move = useCallback((dCol: number, dRow: number) => {
    setSel((s) => ({
      col: clamp(s.col + dCol, 0, COLUMN_COUNT - 1),
      row: clamp(s.row + dRow, 0, ROW_COUNT - 1),
    }));
  }, []);

  const commitEdit = useCallback(
    (dCol: number, dRow: number) => {
      if (editing) setCell(cellId(editing.col, editing.row), editing.value);
      setEditing(null);
      if (dCol !== 0 || dRow !== 0) move(dCol, dRow);
      gridRef.current?.focus();
    },
    [editing, setCell, move],
  );

  const beginEdit = useCallback((target: Selection, initial: string) => {
    setEditing({ ...target, value: initial });
  }, []);

  /* --------------------------------------------------------- grid keys --- */

  const onGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (editing) return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        move(0, -1);
        return;
      case 'ArrowDown':
        e.preventDefault();
        move(0, 1);
        return;
      case 'ArrowLeft':
        e.preventDefault();
        move(-1, 0);
        return;
      case 'ArrowRight':
        e.preventDefault();
        move(1, 0);
        return;
      case 'PageUp':
        e.preventDefault();
        move(0, -10);
        return;
      case 'PageDown':
        e.preventDefault();
        move(0, 10);
        return;
      case 'Home':
        e.preventDefault();
        setSel((s) => (e.ctrlKey || e.metaKey ? { col: 0, row: 0 } : { ...s, col: 0 }));
        return;
      case 'Tab':
        e.preventDefault();
        move(e.shiftKey ? -1 : 1, 0);
        return;
      case 'Enter':
      case 'F2':
        e.preventDefault();
        beginEdit(sel, selRaw);
        return;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        setCell(selId, '');
        return;
      case 'Escape':
        return;
      default:
        break;
    }

    // Typing anywhere on the grid starts an edit with that character.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      beginEdit(sel, e.key);
    }
  };

  const onEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit(0, 1);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit(e.shiftKey ? -1 : 1, 0);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditing(null);
      gridRef.current?.focus();
    }
  };

  /* ------------------------------------------------------------ render --- */

  const columns = useMemo(
    () => Array.from({ length: COLUMN_COUNT }, (_, i) => i),
    [],
  );
  const rows = useMemo(() => Array.from({ length: ROW_COUNT }, (_, i) => i), []);

  const filledCount = Object.keys(cells).length;
  const totalWidth = HEADER_WIDTH + COLUMN_COUNT * COL_WIDTH;

  return (
    <AppFrame
      scroll={false}
      toolbar={
        <>
          <Toolbar>
            <Button onClick={() => setConfirmNew(true)}>New</Button>
            <ToolbarSeparator />
            <Button
              onClick={() => {
                setCell(selId, '');
                gridRef.current?.focus();
              }}
            >
              Clear cell
            </Button>
            <ToolbarSpacer />
            <span className="px-1 text-[10px] text-os-ink-soft">
              {filledCount} {filledCount === 1 ? 'cell' : 'cells'}
            </span>
          </Toolbar>
          <div className="flex shrink-0 items-center gap-1.5 border-b border-os-ink bg-os-chrome px-1.5 py-1">
            <span className="os-inset w-[52px] shrink-0 rounded-[2px] px-1 py-[3px] text-center os-chrome-text text-[10px]">
              {selId}
            </span>
            <span aria-hidden className="shrink-0 px-0.5 text-[12px] italic">
              fx
            </span>
            <TextField
              className="min-w-0 flex-1"
              aria-label={`Contents of ${selId}`}
              value={editing ? editing.value : selRaw}
              onChange={(e) => setEditing({ ...sel, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitEdit(0, 1);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setEditing(null);
                  gridRef.current?.focus();
                }
              }}
              onBlur={() => {
                if (editing) commitEdit(0, 0);
              }}
            />
          </div>
        </>
      }
      status={
        <StatusBar>
          <span>{selId}</span>
          <ToolbarSpacer />
          <span className="truncate text-os-ink-soft">{formatValue(selValue)}</span>
        </StatusBar>
      }
    >
      <div
        ref={gridRef}
        tabIndex={0}
        onKeyDown={onGridKeyDown}
        className="os-scroll h-full w-full overflow-auto bg-os-well outline-none"
      >
        <div style={{ width: totalWidth }} className="select-none">
          {/* Column headers */}
          <div className="sticky top-0 z-20 flex">
            <div
              style={{ width: HEADER_WIDTH, height: ROW_HEIGHT }}
              className="sticky left-0 z-30 shrink-0 border-r border-b border-os-ink bg-os-chrome"
            />
            {columns.map((c) => (
              <div
                key={c}
                style={{ width: COL_WIDTH, height: ROW_HEIGHT }}
                className={`flex shrink-0 items-center justify-center border-r border-b border-os-ink os-chrome-text text-[10px] ${
                  c === sel.col ? 'bg-os-chrome-dim' : 'bg-os-chrome'
                }`}
              >
                {columnLabel(c)}
              </div>
            ))}
          </div>

          {/* Rows */}
          {rows.map((r) => (
            <div key={r} className="flex">
              <div
                style={{ width: HEADER_WIDTH, height: ROW_HEIGHT }}
                className={`sticky left-0 z-10 flex shrink-0 items-center justify-center border-r border-b border-os-ink os-chrome-text text-[10px] ${
                  r === sel.row ? 'bg-os-chrome-dim' : 'bg-os-chrome'
                }`}
              >
                {r + 1}
              </div>
              {columns.map((c) => {
                const id = cellId(c, r);
                const value = sheet.valueOf(id);
                const isSelected = sel.col === c && sel.row === r;
                const isEditing = !!editing && editing.col === c && editing.row === r;
                return (
                  <div
                    key={c}
                    ref={isSelected ? selectedRef : undefined}
                    style={{ width: COL_WIDTH, height: ROW_HEIGHT }}
                    onPointerDown={() => {
                      if (editing && !isEditing) commitEdit(0, 0);
                      setSel({ col: c, row: r });
                      gridRef.current?.focus();
                    }}
                    onDoubleClick={() => beginEdit({ col: c, row: r }, cells[id] ?? '')}
                    className={`relative shrink-0 overflow-hidden border-r border-b border-os-chrome-dark bg-os-face ${
                      isSelected ? 'outline-2 -outline-offset-2 outline-os-accent' : ''
                    }`}
                  >
                    {isEditing ? (
                      <input
                        ref={cellInputRef}
                        value={editing.value}
                        aria-label={`Edit ${id}`}
                        onChange={(e) => setEditing({ col: c, row: r, value: e.target.value })}
                        onKeyDown={onEditKeyDown}
                        onBlur={() => commitEdit(0, 0)}
                        className="absolute inset-0 h-full w-full bg-os-face px-1 font-[family-name:var(--font-os-body)] text-[11px] outline-none"
                      />
                    ) : (
                      <span
                        className={`block truncate px-1 font-[family-name:var(--font-os-body)] text-[11px] leading-[18px] ${
                          value.kind === 'error' ? 'text-os-alert' : 'text-os-ink'
                        } ${alignmentFor(value) === 'right' ? 'text-right' : 'text-left'}`}
                      >
                        {formatValue(value)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {confirmNew && (
        <ConfirmDialog
          title="Spreadsheet"
          message="Discard the current sheet?"
          confirmLabel="New"
          onConfirm={() => {
            reset();
            setEditing(null);
            setSel({ col: 0, row: 0 });
            setConfirmNew(false);
            gridRef.current?.focus();
          }}
          onCancel={() => setConfirmNew(false)}
        />
      )}
    </AppFrame>
  );
}
