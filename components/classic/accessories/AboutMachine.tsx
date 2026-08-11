'use client';

/**
 * About This Machine — the spec sheet for a computer that does not exist.
 *
 * OWNER: Classic Boot agent. Cosmetic.
 *
 * The name comes from content/bio.ts, never from a string in here.
 */
import { ClassicMark } from '@/components/classic/BrandMarks';
import { BIT_FONT, BitRule } from '@/components/classic/ui/Bit';
import { bio } from '@/content/bio';

const SPECS: [string, string][] = [
  ['System', 'Classic 1.0'],
  ['Finder', '1.0'],
  ['Display', '512 × 342, 1 bit'],
  ['Total Memory', '128K'],
  ['Colours', 'Two. Both of them.'],
];

export default function AboutMachine() {
  return (
    <div className={`${BIT_FONT} flex h-full flex-col gap-3 bg-white p-3 text-black`}>
      <div className="flex items-center gap-3">
        <ClassicMark size={40} />
        <div className="min-w-0">
          <p className="truncate text-[12px] leading-tight">{bio.name}</p>
          <p className="truncate text-[8px] leading-tight">{bio.tagline}</p>
        </div>
      </div>

      <BitRule />

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-[5px] text-[9px] leading-none">
        {SPECS.map(([term, value]) => (
          <div key={term} className="contents">
            <dt>{term}</dt>
            <dd className="text-right">{value}</dd>
          </div>
        ))}
      </dl>

      <BitRule />

      <p className="text-[8px] leading-[1.7]">
        A software update is available for this machine. It adds colour, windows
        you can resize, and a thing called the World Wide Web.
      </p>
    </div>
  );
}
