'use client';

/**
 * The startup disk, opened: a Finder-ish grid of the desk accessories.
 *
 * OWNER: Classic Boot agent.
 *
 * Single click opens rather than selects. Not strictly period-correct — the
 * real one wanted a double-click — but this is a doorway a visitor passes
 * through in a few seconds, on a phone as often as not, and double-tap is a
 * bad joke on a touchscreen.
 */
import { useClassicSystem } from '@/components/classic/ClassicContext';
import {
  ACCESSORY_META,
  DESK_ACCESSORIES,
} from '@/components/classic/accessories/catalog';
import { BIT_FONT } from '@/components/classic/ui/Bit';
import PixelIcon from '@/components/classic/ui/PixelIcon';

export default function DiskWindow() {
  const { open } = useClassicSystem();

  return (
    <div className={`${BIT_FONT} flex h-full flex-col bg-white text-black`}>
      <p className="shrink-0 border-b border-black px-2 py-1 text-[9px] leading-none">
        {DESK_ACCESSORIES.length} items — 128K in disk
      </p>

      <div className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(74px,1fr))] content-start gap-1 p-2">
        {DESK_ACCESSORIES.map((id) => {
          const meta = ACCESSORY_META[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => open(id)}
              className="flex cursor-default flex-col items-center gap-1 p-1 text-[8px] leading-none text-black focus-visible:shadow-[inset_0_0_0_2px_#000] focus-visible:outline-none active:bg-black active:text-white"
            >
              <PixelIcon map={meta.icon} size={32} />
              <span className="w-full text-center break-words">{meta.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
