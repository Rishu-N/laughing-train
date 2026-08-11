'use client';

/**
 * Fact-sweeper — the Dossier.
 *
 * The reason the game exists: a file on the owner that fills in as you clear
 * sectors, grouped by category and persisted between visits. Losing a board
 * never empties it.
 *
 * Every string of substance here comes from `content/facts.ts`; the only text
 * this file owns is chrome (headings, counts, button labels).
 */
import { Button } from '@/components/os/ui';
import type { Fact, FactCategory } from '@/content/types';
import {
  ALL_FACTS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  RARITY_LABELS,
  getFact,
  lockedCount,
  poolFor,
} from './factPool';
import type { Difficulty } from './types';

export interface DossierProps {
  /** Fact ids the player has recovered, ever. */
  recovered: ReadonlySet<string>;
  difficulty: Difficulty;
  onReset: () => void;
  /** Narrow layout only: dismiss the panel and go back to the board. */
  onClose?: () => void;
}

export function Dossier({ recovered, difficulty, onReset, onClose }: DossierProps) {
  // Count against facts that still exist — the owner may have deleted a fact
  // that some visitor recovered months ago, and a 52/51 readout looks broken.
  const known: Fact[] = ALL_FACTS.filter((f) => recovered.has(f.id));
  const total = ALL_FACTS.length;
  const onThisDisk = poolFor(difficulty).length;
  const sealed = lockedCount(difficulty);
  const pct = total === 0 ? 0 : Math.round((known.length / total) * 100);

  const byCategory = new Map<FactCategory, Fact[]>();
  for (const fact of known) {
    const list = byCategory.get(fact.category) ?? [];
    list.push(fact);
    byCategory.set(fact.category, list);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex items-center gap-1">
        <div className="flex-1 os-chrome-text text-[10px] tracking-wide">DOSSIER</div>
        {onClose && (
          <Button className="px-2 py-1 text-[10px]" onClick={onClose}>
            Board
          </Button>
        )}
      </div>

      {/* Progress */}
      <div>
        <div className="os-inset h-[10px] w-full rounded-[2px] p-[1px]">
          <div
            className="h-full bg-os-accent"
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={known.length}
            aria-label="Facts recovered"
          />
        </div>
        <div className="mt-1 os-chrome-text text-[9px] text-os-ink-soft">
          {known.length} / {total} recovered
        </div>
        <div className="os-chrome-text text-[9px] text-os-ink-soft">
          {onThisDisk} readable on this disk
          {sealed > 0 ? ` · ${sealed} sealed deeper` : ''}
        </div>
      </div>

      {/* Recovered facts, grouped */}
      <div className="os-scroll min-h-0 flex-1 overflow-y-auto">
        {known.length === 0 ? (
          <p className="px-1 py-2 font-[family-name:var(--font-os-body)] text-[11px] leading-snug text-os-ink-soft">
            Nothing recovered yet. Clear a sector to pull the first record off
            the disk.
          </p>
        ) : (
          CATEGORY_ORDER.map((category) => {
            const list = byCategory.get(category);
            if (!list || list.length === 0) return null;
            return (
              <section key={category} className="mb-2">
                <h3 className="sticky top-0 mb-1 bg-os-chrome os-chrome-text text-[9px] tracking-wide text-os-ink-soft">
                  {CATEGORY_LABELS[category].toUpperCase()} · {list.length}
                </h3>
                <ul className="m-0 list-none p-0">
                  {list.map((fact) => (
                    <li
                      key={fact.id}
                      className="border-b border-os-chrome-dark/40 py-[3px] last:border-b-0"
                    >
                      <div className="flex items-baseline gap-1">
                        <span className="os-chrome-text text-[9px] text-os-ink-soft">
                          {fact.label}
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
                            title={RARITY_LABELS[fact.rarity]}
                          >
                            {fact.rarity === 'rare' ? '★' : '◆'}
                          </span>
                        )}
                      </div>
                      <div className="font-[family-name:var(--font-os-body)] text-[11px] leading-snug">
                        {fact.value}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>

      <Button className="w-full px-2 py-1 text-[10px]" onClick={onReset}>
        Reset Dossier…
      </Button>
    </div>
  );
}
