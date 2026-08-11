'use client';

/**
 * Scrapbook — pages through a handful of 1-bit pictures.
 *
 * OWNER: Classic Boot agent. Cosmetic homage; the pictures are generated
 * ordered-dither test images (see scrapbookArt.ts), not user content.
 */
import { useState } from 'react';
import { SCRAPBOOK_PAGES } from '@/components/classic/accessories/scrapbookArt';
import { BIT_FONT, BitButton } from '@/components/classic/ui/Bit';
import PixelIcon from '@/components/classic/ui/PixelIcon';

export default function Scrapbook() {
  const [page, setPage] = useState(0);
  const total = SCRAPBOOK_PAGES.length;
  const current = SCRAPBOOK_PAGES[page];

  const go = (delta: number) => setPage((p) => (p + delta + total) % total);

  return (
    <div className={`${BIT_FONT} flex h-full flex-col bg-white p-2 text-black`}>
      <div className="flex min-h-0 flex-1 items-center justify-center border border-black p-2">
        <div className="w-full max-w-[180px] text-black">
          <PixelIcon map={current.map} size={180} className="h-auto w-full" />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex gap-1">
          <BitButton aria-label="Previous page" onClick={() => go(-1)}>
            ◀
          </BitButton>
          <BitButton aria-label="Next page" onClick={() => go(1)}>
            ▶
          </BitButton>
        </div>
        <span aria-live="polite" className="truncate text-[9px] leading-none">
          {current.title} — {page + 1}/{total}
        </span>
      </div>
    </div>
  );
}
