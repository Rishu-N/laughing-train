'use client';

/**
 * Control Panel — one panel, a handful of settings, most of them a lie.
 *
 * OWNER: Classic Boot agent.
 *
 * Two of them are real: the desktop pattern and the menu-bar clock genuinely
 * change the machine. The rest are plausible period settings that move and
 * remember their position and do nothing else, which is roughly what half of
 * them did anyway.
 */
import { useState } from 'react';
import { useClassicSystem } from '@/components/classic/ClassicContext';
import { BIT_FONT, BitRule } from '@/components/classic/ui/Bit';
import { PATTERNS, patternStyle } from '@/lib/classic/patterns';

const BLINK_RATES = ['Slow', 'Medium', 'Fast'];
const CLICK_SPEEDS = ['Slow', 'Medium', 'Fast'];
const VOLUME_STEPS = 7;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-[6px]">
      <span className="shrink-0 text-[9px] leading-none">{label}</span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

function Choice({
  options,
  value,
  onChange,
  label,
}: {
  options: string[];
  value: number;
  onChange: (i: number) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {options.map((option, i) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === i}
          onClick={() => onChange(i)}
          className={[
            'cursor-default border border-black px-[6px] py-[2px] text-[8px] leading-none',
            'focus-visible:shadow-[inset_0_0_0_2px_#000] focus-visible:outline-none',
            value === i ? 'bg-black text-white' : 'bg-white text-black',
          ].join(' ')}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export default function ControlPanel() {
  const { pattern, setPattern, menuClock, setMenuClock } = useClassicSystem();
  const [volume, setVolume] = useState(3);
  const [blink, setBlink] = useState(1);
  const [click, setClick] = useState(1);

  return (
    <div className={`${BIT_FONT} h-full bg-white p-2 text-black`}>
      <fieldset className="border border-black p-2">
        <legend className="px-1 text-[9px] leading-none">Desktop Pattern</legend>
        <div role="radiogroup" aria-label="Desktop pattern" className="flex flex-wrap gap-1">
          {PATTERNS.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={pattern === i}
              aria-label={p.label}
              onClick={() => setPattern(i)}
              className={[
                'h-[24px] w-[24px] cursor-default border border-black',
                'focus-visible:shadow-[inset_0_0_0_2px_#000] focus-visible:outline-none',
                pattern === i ? 'shadow-[0_0_0_2px_#fff,0_0_0_3px_#000]' : '',
              ].join(' ')}
              style={patternStyle(i)}
            />
          ))}
        </div>
      </fieldset>

      <div className="mt-2 border border-black px-2">
        <Row label="Speaker Volume">
          <div
            role="group"
            aria-label="Speaker volume"
            className="flex items-end gap-[2px]"
          >
            {Array.from({ length: VOLUME_STEPS }, (_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Volume ${i + 1}`}
                aria-pressed={volume === i}
                onClick={() => setVolume(i)}
                className={[
                  'w-[8px] cursor-default border border-black',
                  'focus-visible:shadow-[inset_0_0_0_2px_#000] focus-visible:outline-none',
                  i <= volume ? 'bg-black' : 'bg-white',
                ].join(' ')}
                style={{ height: 6 + i * 2 }}
              />
            ))}
          </div>
        </Row>

        <BitRule />

        <Row label="Insertion Point Blinks">
          <Choice
            label="Insertion point blink rate"
            options={BLINK_RATES}
            value={blink}
            onChange={setBlink}
          />
        </Row>

        <BitRule />

        <Row label="Double-Click Speed">
          <Choice
            label="Double-click speed"
            options={CLICK_SPEEDS}
            value={click}
            onChange={setClick}
          />
        </Row>

        <BitRule />

        <Row label="Clock in Menu Bar">
          <button
            type="button"
            role="switch"
            aria-checked={menuClock}
            aria-label="Show clock in menu bar"
            onClick={() => setMenuClock(!menuClock)}
            className="flex h-[14px] w-[14px] cursor-default items-center justify-center border border-black text-[10px] leading-none active:bg-black active:text-white focus-visible:shadow-[inset_0_0_0_2px_#000] focus-visible:outline-none"
          >
            {menuClock ? '✕' : ''}
          </button>
        </Row>
      </div>
    </div>
  );
}
