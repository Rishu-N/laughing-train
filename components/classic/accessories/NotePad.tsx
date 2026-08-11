'use client';

/**
 * Note Pad — a small lined pad with eight pages.
 *
 * OWNER: Classic Boot agent. Cosmetic homage.
 *
 * Deliberately not persisted: the classic shell is a doorway the visitor passes
 * through once per visit, and a note that survived into the colour OS would
 * imply a filesystem this machine does not have.
 */
import { useState } from 'react';
import { BIT_FONT } from '@/components/classic/ui/Bit';

const PAGES = 8;
const LINE_HEIGHT = 18;

export default function NotePad() {
  const [pages, setPages] = useState<string[]>(() => Array(PAGES).fill(''));
  const [page, setPage] = useState(0);

  const setText = (text: string) =>
    setPages((all) => all.map((p, i) => (i === page ? text : p)));

  return (
    <div className={`${BIT_FONT} flex h-full flex-col bg-white text-black`}>
      <textarea
        aria-label={`Note Pad page ${page + 1}`}
        value={pages[page]}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        className="min-h-0 flex-1 resize-none border-0 bg-transparent px-2 text-[10px] outline-none"
        style={{
          lineHeight: `${LINE_HEIGHT}px`,
          // Ruled paper: a hard 1px rule under every line of text.
          backgroundImage:
            `repeating-linear-gradient(to bottom, transparent 0px, transparent ${LINE_HEIGHT - 1}px, #000 ${LINE_HEIGHT - 1}px, #000 ${LINE_HEIGHT}px)`,
          backgroundPositionY: '2px',
        }}
      />

      <div className="flex shrink-0 items-center justify-between border-t border-black px-2 py-1">
        <span className="text-[9px] leading-none">
          Page {page + 1} of {PAGES}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Previous page"
            onClick={() => setPage((p) => (p - 1 + PAGES) % PAGES)}
            className="cursor-default border border-black px-2 text-[9px] leading-[14px] active:bg-black active:text-white focus-visible:shadow-[inset_0_0_0_2px_#000] focus-visible:outline-none"
          >
            ◀
          </button>
          <button
            type="button"
            aria-label="Next page"
            onClick={() => setPage((p) => (p + 1) % PAGES)}
            className="cursor-default border border-black px-2 text-[9px] leading-[14px] active:bg-black active:text-white focus-visible:shadow-[inset_0_0_0_2px_#000] focus-visible:outline-none"
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}
