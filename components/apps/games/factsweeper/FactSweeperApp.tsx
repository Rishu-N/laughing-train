'use client';

/**
 * FACT-SWEEPER
 *
 * Minesweeper, reskinned as a disk-recovery utility. The grid is a corrupted
 * volume; every safe sector you clear pulls one record about the owner off the
 * disk and files it in the Dossier, which persists between visits.
 *
 * Three rules make it a game rather than a clone:
 *   1. First click is always safe — mines are placed after it (see engine.ts).
 *   2. Rarity gates depth — only the Hard volume surfaces `rare` facts.
 *   3. Hitting a mine costs the BOARD, never the DOSSIER. Facts are committed
 *      to storage the instant they're recovered, so a loss can never take back
 *      something the player already read. Punishing exploration would defeat
 *      the entire point of the feature.
 *
 * No fact text lives in this file. Everything readable comes from
 * `content/facts.ts` via factPool.ts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppFrame,
  AppSidebar,
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
import { BoardView } from './Board';
import { Dossier } from './Dossier';
import {
  chordAt,
  cloneBoard,
  createBoard,
  detonate,
  flagAllMines,
  flagCount,
  isWon,
  revealFrom,
  revealedCount,
  safeCellCount,
  seedBoard,
  type Board,
} from './engine';
import { ALL_FACTS, drawFacts, getFact, RARITY_LABELS } from './factPool';
import {
  configFor,
  DIFFICULTIES,
  EMPTY_SESSION,
  normalizeSession,
  type Difficulty,
  type FactSweeperSession,
} from './types';

/** Width of the docked dossier rail. */
const DOSSIER_WIDTH = 208;
/** Below this total interior width the dossier stops being a rail and becomes a
 *  toggleable panel, so the board still fits at 375px. */
const DOCK_MIN_WIDTH = 580;

type GameStatus = 'ready' | 'playing' | 'won' | 'lost';

interface Readout {
  factId: string;
  /** Already in the dossier — recovered again because the pool ran dry. */
  repeat: boolean;
  /** Other sectors opened by the same click. */
  extra: number;
  /** Player clicked an already-cleared sector to re-read it. */
  reread: boolean;
}

function formatClock(seconds: number | null): string {
  if (seconds === null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function FactSweeperApp({ instanceId, setTitle }: AppWindowProps) {
  const [rawSession, setSession, resetSession] = useAppSession<FactSweeperSession>(
    'factsweeper',
    EMPTY_SESSION,
  );
  const session = useMemo(() => normalizeSession(rawSession), [rawSession]);
  const recovered = useMemo(() => new Set(session.recovered), [session.recovered]);

  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const config = configFor(difficulty);

  const [board, setBoard] = useState<Board>(() => createBoard(configFor('easy')));
  const [status, setStatus] = useState<GameStatus>('ready');
  const [elapsed, setElapsed] = useState(0);
  const [readout, setReadout] = useState<Readout | null>(null);
  const [roundFresh, setRoundFresh] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [flagMode, setFlagMode] = useState(false);
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const [askingReset, setAskingReset] = useState(false);
  const [dossierDocked, setDossierDocked] = useState(true);
  const [dossierOpen, setDossierOpen] = useState(false);

  const startedAt = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  /* ------------------------------------------------------------ layout ---- */

  // The dossier rail collapses on narrow windows. Measuring the body and adding
  // the rail's own width back keeps the comparison against a value that doesn't
  // change when the rail appears, so this can't oscillate.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setDossierDocked((wasDocked) => width + (wasDocked ? DOSSIER_WIDTH : 0) >= DOCK_MIN_WIDTH);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ------------------------------------------------------------- title ---- */

  const lastTitle = useRef('');
  useEffect(() => {
    const next = `Fact-sweeper — ${config.label}`;
    if (next === lastTitle.current) return;
    lastTitle.current = next;
    setTitle(next);
  }, [config.label, setTitle]);

  /* ------------------------------------------------------------- timer ---- */

  useEffect(() => {
    if (status !== 'playing') return;
    const id = setInterval(() => {
      setElapsed(Math.min(999, Math.floor((Date.now() - startedAt.current) / 1000)));
    }, 250);
    return () => clearInterval(id);
  }, [status]);

  /* -------------------------------------------------------- game control -- */

  const startGame = useCallback((next: Difficulty) => {
    setDifficulty(next);
    setBoard(createBoard(configFor(next)));
    setStatus('ready');
    setElapsed(0);
    setReadout(null);
    setRoundFresh(0);
    setCursor(0);
    setOverlayDismissed(false);
    setDossierOpen(false);
  }, []);

  /**
   * Hand freshly opened sectors their facts and commit anything new to storage
   * immediately — that immediacy is what makes losing harmless.
   */
  const assignFacts = useCallback(
    (next: Board, opened: number[], reread = false) => {
      const draws = drawFacts(difficulty, recovered, opened.length);
      const fresh: string[] = [];
      opened.forEach((cellIndex, i) => {
        const draw = draws[i];
        if (!draw) return;
        next.cells[cellIndex].factId = draw.factId;
        next.cells[cellIndex].factRepeat = draw.repeat;
        if (!draw.repeat) fresh.push(draw.factId);
      });

      const latest = draws.length > 0 ? draws[draws.length - 1] : null;
      if (latest) {
        setReadout({
          factId: latest.factId,
          repeat: latest.repeat,
          extra: draws.length - 1,
          reread,
        });
      }

      if (fresh.length > 0) {
        setRoundFresh((n) => n + fresh.length);
        setSession((prev) => {
          const seen = new Set(prev.recovered);
          const added = fresh.filter((id) => !seen.has(id));
          if (added.length === 0) return prev;
          return { ...prev, recovered: [...prev.recovered, ...added] };
        });
      }
    },
    [difficulty, recovered, setSession],
  );

  const finish = useCallback(
    (next: Board) => {
      if (!isWon(next)) return false;
      flagAllMines(next);
      const time = Math.min(999, Math.floor((Date.now() - startedAt.current) / 1000));
      setElapsed(time);
      setStatus('won');
      setOverlayDismissed(false);
      setSession((prev) => {
        const best = prev.best?.[difficulty] ?? null;
        if (best !== null && best <= time) return prev;
        return { ...prev, best: { ...prev.best, [difficulty]: time } };
      });
      return true;
    },
    [difficulty, setSession],
  );

  const lose = useCallback((next: Board, mineIndex: number) => {
    detonate(next, mineIndex);
    setBoard(next);
    setStatus('lost');
    setOverlayDismissed(false);
  }, []);

  const handlePrimary = useCallback(
    (index: number) => {
      const current = board.cells[index];

      // Finished board: clicks only re-read what a sector already gave up, so a
      // won or lost disk stays browsable.
      if (status === 'won' || status === 'lost') {
        if (current.revealed && current.factId) {
          setReadout({
            factId: current.factId,
            repeat: current.factRepeat,
            extra: 0,
            reread: true,
          });
        }
        return;
      }

      if (current.flagged) return;

      // Already cleared: chord if the flags support it, otherwise just re-read
      // whatever this sector gave up earlier.
      if (current.revealed) {
        const plan = chordAt(board, index);
        if (plan.targets.length === 0) {
          if (current.factId) {
            setReadout({
              factId: current.factId,
              repeat: current.factRepeat,
              extra: 0,
              reread: true,
            });
          }
          return;
        }
        const next = cloneBoard(board);
        if (plan.hitsMine) {
          const mineIndex = plan.targets.find((t) => next.cells[t].mine);
          if (mineIndex !== undefined) lose(next, mineIndex);
          return;
        }
        const opened: number[] = [];
        for (const target of plan.targets) opened.push(...revealFrom(next, target));
        assignFacts(next, opened);
        finish(next);
        setBoard(next);
        return;
      }

      const next = cloneBoard(board);
      if (!next.seeded) {
        // Mines land AFTER the first click, so the opening move is always safe.
        seedBoard(next, index);
        startedAt.current = Date.now();
        setStatus('playing');
      }

      if (next.cells[index].mine) {
        lose(next, index);
        return;
      }

      const opened = revealFrom(next, index);
      assignFacts(next, opened);
      finish(next);
      setBoard(next);
    },
    [board, status, assignFacts, finish, lose],
  );

  const handleFlag = useCallback(
    (index: number) => {
      if (status === 'won' || status === 'lost') return;
      const cell = board.cells[index];
      if (cell.revealed) return;
      const next = cloneBoard(board);
      next.cells[index].flagged = !next.cells[index].flagged;
      setBoard(next);
    },
    [board, status],
  );

  const handleResetDossier = useCallback(() => {
    resetSession();
    setAskingReset(false);
    startGame(difficulty);
  }, [resetSession, startGame, difficulty]);

  /* -------------------------------------------------------------- derived -- */

  const minesLeft = board.mineCount - flagCount(board);
  const cleared = revealedCount(board);
  const safeTotal = safeCellCount(board);
  const knownCount = ALL_FACTS.filter((f) => recovered.has(f.id)).length;
  const best = session.best[difficulty];
  const overlayVisible = (status === 'won' || status === 'lost') && !overlayDismissed;
  const nextDifficulty: Difficulty | null =
    difficulty === 'easy' ? 'medium' : difficulty === 'medium' ? 'hard' : null;

  const statusText =
    status === 'lost'
      ? 'SECTOR CORRUPTED'
      : status === 'won'
        ? 'VOLUME RECOVERED'
        : status === 'playing'
          ? 'RECOVERING…'
          : 'DISK MOUNTED';

  const dossierPanel = (
    <Dossier
      recovered={recovered}
      difficulty={difficulty}
      onReset={() => setAskingReset(true)}
      onClose={dossierDocked ? undefined : () => setDossierOpen(false)}
    />
  );

  return (
    <AppFrame
      scroll={false}
      sidebarSide="right"
      sidebar={
        dossierDocked ? (
          <AppSidebar side="right" width={DOSSIER_WIDTH}>
            {dossierPanel}
          </AppSidebar>
        ) : undefined
      }
      toolbar={
        <Toolbar className="flex-wrap gap-y-1">
          <Select
            aria-label="Disk size"
            value={difficulty}
            onChange={(e) => startGame(e.target.value as Difficulty)}
          >
            {DIFFICULTIES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </Select>
          <Button className="px-2 py-[4px] text-[10px]" onClick={() => startGame(difficulty)}>
            New Disk
          </Button>
          <ToolbarSeparator />
          <IconButton
            label="Flag mode (tap to flag)"
            active={flagMode}
            onClick={() => setFlagMode((v) => !v)}
          >
            ⚑
          </IconButton>
          <ToolbarSpacer />
          <Counter label="Corrupt sectors remaining" value={minesLeft} />
          <Counter label="Elapsed seconds" value={elapsed} />
          {!dossierDocked && (
            <Button
              className="px-2 py-[4px] text-[10px]"
              onClick={() => setDossierOpen((v) => !v)}
            >
              {dossierOpen ? 'Board' : `Dossier ${knownCount}`}
            </Button>
          )}
        </Toolbar>
      }
      status={
        <StatusBar className="overflow-hidden">
          <span className="shrink-0">{statusText}</span>
          <span className="truncate text-os-ink-soft">
            {config.volume} · {cleared}/{safeTotal} sectors
          </span>
          <ToolbarSpacer />
          <span className="shrink-0 text-os-ink-soft">
            {knownCount}/{ALL_FACTS.length} facts
          </span>
          <span className="shrink-0 text-os-ink-soft">best {formatClock(best)}</span>
        </StatusBar>
      }
    >
      <div ref={bodyRef} className="flex h-full min-h-0 w-full flex-col">
        {!dossierDocked && dossierOpen ? (
          <div className="min-h-0 flex-1 bg-os-chrome p-2">{dossierPanel}</div>
        ) : (
          <>
            <RecoveredStrip readout={readout} status={status} />
            <div
              className="os-scroll relative min-h-0 flex-1 overflow-auto p-3"
              style={{ background: 'var(--color-os-well)' }}
            >
              {/* `safe center` keeps a board wider than the window reachable —
                  plain centring would clip its left edge out of scroll range. */}
              <div
                className="flex min-h-full w-full items-start"
                style={{ justifyContent: 'safe center' }}
              >
                <BoardView
                  board={board}
                  cellSize={config.cell}
                  frozen={status === 'won' || status === 'lost'}
                  cursor={cursor}
                  idPrefix={instanceId}
                  flagMode={flagMode}
                  onPrimary={handlePrimary}
                  onFlag={handleFlag}
                  onCursorChange={setCursor}
                />
              </div>

              {overlayVisible && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 p-4">
                  <div className="os-window w-[300px] max-w-full rounded-[3px] p-4 text-center">
                    <div
                      className="os-chrome-text text-[12px]"
                      style={{
                        color:
                          status === 'won'
                            ? 'var(--color-os-ok)'
                            : 'var(--color-os-alert)',
                      }}
                    >
                      {status === 'won' ? 'VOLUME RECOVERED' : 'SECTOR CORRUPTED'}
                    </div>
                    <p className="mt-2 font-[family-name:var(--font-os-body)] text-[12px] leading-snug">
                      {status === 'won'
                        ? `Every readable sector on the ${config.volume} volume has been pulled in ${formatClock(elapsed)}.`
                        : 'The read head hit a bad sector and the volume was re-imaged.'}
                    </p>
                    <p className="mt-2 font-[family-name:var(--font-os-body)] text-[12px] leading-snug">
                      {roundFresh > 0
                        ? `${roundFresh} new ${roundFresh === 1 ? 'record' : 'records'} filed this session.`
                        : 'No new records this session.'}{' '}
                      <span className="text-os-ink-soft">
                        Dossier intact — {knownCount} kept.
                      </span>
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <Button onClick={() => setOverlayDismissed(true)}>Inspect</Button>
                      {status === 'won' && nextDifficulty && (
                        <Button onClick={() => startGame(nextDifficulty)}>
                          Deeper disk
                        </Button>
                      )}
                      <Button isDefault onClick={() => startGame(difficulty)}>
                        New Disk
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {askingReset && (
        <ConfirmDialog
          title="Reset Dossier"
          message={`This erases all ${knownCount} recovered records from this browser. The facts can be found again, but the file starts empty.`}
          confirmLabel="Erase"
          cancelLabel="Cancel"
          onConfirm={handleResetDossier}
          onCancel={() => setAskingReset(false)}
        />
      )}
    </AppFrame>
  );
}

/* ------------------------------------------------------------ sub-views ---- */

/** Three-digit LED counter, the way every sweeper has had since 1990. */
function Counter({ label, value }: { label: string; value: number }) {
  const clamped = Math.max(-99, Math.min(999, value));
  const text =
    clamped < 0 ? `-${String(Math.abs(clamped)).padStart(2, '0')}` : String(clamped).padStart(3, '0');
  return (
    <span
      // role="img" + aria-label: the digits are a glyph readout, so announce the
      // labelled value rather than three loose numerals.
      role="img"
      aria-label={`${label}: ${value}`}
      title={label}
      className="os-inset rounded-[2px] px-1 py-[2px] font-[family-name:var(--font-os-ui)] text-[11px] leading-none tabular-nums"
      style={{ background: 'var(--color-os-ink)', color: 'var(--color-os-alert)' }}
    >
      {text}
    </span>
  );
}

/** The "RECOVERED:" readout — the newest fact, front and centre. */
function RecoveredStrip({
  readout,
  status,
}: {
  readout: Readout | null;
  status: GameStatus;
}) {
  const fact = readout ? getFact(readout.factId) : null;

  return (
    <div className="shrink-0 border-b border-os-ink bg-os-chrome px-2 py-1.5">
      <div
        aria-live="polite"
        className="os-inset flex min-h-[40px] flex-wrap items-center gap-x-2 gap-y-1 rounded-[2px] px-2 py-1.5"
      >
        {fact ? (
          <>
            <span className="os-chrome-text text-[9px] text-os-accent">
              {readout?.reread ? 'ON FILE:' : readout?.repeat ? 'DUPLICATE:' : 'RECOVERED:'}
            </span>
            <span className="os-chrome-text text-[9px] text-os-ink-soft">{fact.label}</span>
            <span className="min-w-0 font-[family-name:var(--font-os-body)] text-[12px] leading-snug">
              {fact.value}
            </span>
            {fact.rarity !== 'common' && (
              <span
                className="os-chrome-text text-[8px]"
                style={{
                  color:
                    fact.rarity === 'rare'
                      ? 'var(--color-os-alert)'
                      : 'var(--color-os-ink-soft)',
                }}
              >
                {RARITY_LABELS[fact.rarity]}
              </span>
            )}
            {readout && readout.extra > 0 && (
              <span className="os-chrome-text text-[9px] text-os-ink-soft">
                +{readout.extra} more filed
              </span>
            )}
          </>
        ) : (
          <span className="font-[family-name:var(--font-os-body)] text-[12px] text-os-ink-soft">
            {status === 'lost'
              ? 'Volume re-imaged. Mount a new disk to keep digging.'
              : 'Click a sector to start recovering records. Right-click (or long-press) to flag.'}
          </span>
        )}
      </div>
    </div>
  );
}
