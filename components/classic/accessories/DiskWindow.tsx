'use client';

/**
 * The startup disk, opened: a Finder-ish grid of what is on it.
 *
 * OWNER: Classic Boot agent.
 *
 * Two groups, and the order is the point. Applications come first because they
 * are what you launched a machine to use; the desk accessories follow because
 * they were always there anyway, hanging under the mark menu. This window is
 * the only way to reach BitPaint and BitWrite, which is exactly the state of
 * affairs in 1984.
 *
 * Single click opens rather than selects. Not strictly period-correct — the
 * real one wanted a double-click — but this is a doorway a visitor passes
 * through in a few seconds, on a phone as often as not, and double-tap is a
 * bad joke on a touchscreen.
 */
import { useClassicSystem } from '@/components/classic/ClassicContext';
import {
  ACCESSORY_META,
  APPLICATIONS,
  DESK_ACCESSORIES,
} from '@/components/classic/accessories/catalog';
import type { AccessoryId } from '@/components/classic/accessories/types';
import { BIT_FONT } from '@/components/classic/ui/Bit';
import PixelIcon from '@/components/classic/ui/PixelIcon';

export default function DiskWindow() {
  const { open } = useClassicSystem();
  const total = APPLICATIONS.length + DESK_ACCESSORIES.length;

  return (
    <div className={`${BIT_FONT} flex h-full flex-col bg-white text-black`}>
      <p className="shrink-0 border-b border-black px-2 py-1 text-[9px] leading-none">
        {total} items — 400K in disk
      </p>

      <div className="min-h-0 flex-1 overflow-auto p-2">
        <Group label="Applications" ids={APPLICATIONS} onOpen={open} />
        <Group label="Desk Accessories" ids={DESK_ACCESSORIES} onOpen={open} />
      </div>
    </div>
  );
}

function Group({
  label,
  ids,
  onOpen,
}: {
  label: string;
  ids: readonly AccessoryId[];
  onOpen: (id: AccessoryId) => void;
}) {
  return (
    // Named explicitly: a <section> carrying only a visible <h2> is a plain
    // generic node to anything not looking at the screen, so the split between
    // applications and desk accessories would be invisible to a screen reader.
    <section role="group" aria-label={label} className="mb-2 last:mb-0">
      {/* A reversed slug rather than a heavier weight: the pixel font has one
          weight, so inverting is the only emphasis this screen owns. */}
      <h2 className="mb-1 bg-black px-1 py-[2px] text-[8px] leading-none text-white">
        {label}
      </h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(74px,1fr))] content-start gap-1">
        {ids.map((id) => {
          const meta = ACCESSORY_META[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => onOpen(id)}
              className="flex cursor-default flex-col items-center gap-1 p-1 text-[8px] leading-none text-black focus-visible:shadow-[inset_0_0_0_2px_#000] focus-visible:outline-none active:bg-black active:text-white"
            >
              <PixelIcon map={meta.icon} size={32} />
              <span className="w-full text-center break-words">{meta.title}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
