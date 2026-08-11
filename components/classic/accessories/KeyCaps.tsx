'use client';

/**
 * Key Caps — a keyboard that lights up the key you are actually pressing.
 *
 * OWNER: Classic Boot agent. Cosmetic homage, but the highlighting is real.
 *
 * Listeners are scoped to this window rather than the document: the events come
 * up from the focused window body, so Key Caps can't steal keystrokes from the
 * Calculator sitting behind it. Any keys still held when focus leaves are
 * released on blur, otherwise they stick down forever.
 */
import { useState, type KeyboardEvent } from 'react';
import { BIT_FONT } from '@/components/classic/ui/Bit';

interface Cap {
  /** What the cap says. */
  label: string;
  /** Matched against the normalised KeyboardEvent.key. */
  id: string;
  /** Relative width, in units of one key. */
  span?: number;
  /** What clicking it types, if anything. */
  types?: string;
}

const cap = (label: string, extra: Partial<Cap> = {}): Cap => ({
  label,
  id: label,
  types: label.length === 1 ? label : undefined,
  ...extra,
});

const letters = (s: string): Cap[] => s.split('').map((c) => cap(c));

const ROWS: Cap[][] = [
  [...letters('1234567890'), cap('DEL', { id: 'BACKSPACE', span: 1.6 })],
  [...letters('QWERTYUIOP'), cap('['), cap(']')],
  [...letters('ASDFGHJKL'), cap(';'), cap('RET', { id: 'ENTER', span: 1.6 })],
  [cap('SHIFT', { id: 'SHIFT', span: 1.8 }), ...letters('ZXCVBNM'), cap(','), cap('.')],
  [cap('SPACE', { id: ' ', span: 8, types: ' ' })],
];

/** Normalise a physical key to the ids used above. */
function normalise(key: string): string {
  if (key === ' ') return ' ';
  if (key.length === 1) return key.toUpperCase();
  return key.toUpperCase();
}

export default function KeyCaps() {
  const [down, setDown] = useState<ReadonlySet<string>>(new Set());
  const [typed, setTyped] = useState('');

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') return; // let the window close
    if (e.key === ' ' || e.key === 'Backspace') e.preventDefault();
    const id = normalise(e.key);
    setDown((s) => new Set(s).add(id));
    if (e.key.length === 1) setTyped((t) => (t + e.key).slice(-28));
    if (e.key === 'Backspace') setTyped((t) => t.slice(0, -1));
  };

  const onKeyUp = (e: KeyboardEvent<HTMLDivElement>) => {
    const id = normalise(e.key);
    setDown((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  };

  return (
    <div
      className={`${BIT_FONT} flex h-full flex-col gap-2 bg-white p-2 text-black`}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={() => setDown(new Set())}
    >
      <output
        aria-label="Typed characters"
        className="block h-[20px] truncate border border-black px-2 text-[11px] leading-[18px] whitespace-pre"
      >
        {typed}
      </output>

      <div className="flex flex-col gap-[2px]">
        {ROWS.map((row, i) => (
          <div key={i} className="flex gap-[2px]">
            {row.map((k) => {
              const isDown = down.has(k.id);
              return (
                <button
                  key={k.id + k.label}
                  type="button"
                  aria-label={k.label}
                  aria-pressed={isDown}
                  onClick={() => k.types && setTyped((t) => (t + k.types).slice(-28))}
                  className={[
                    'flex h-[18px] min-w-0 cursor-default items-center justify-center',
                    'border border-black text-[8px] leading-none select-none',
                    'focus-visible:shadow-[inset_0_0_0_2px_#000] focus-visible:outline-none',
                    isDown ? 'bg-black text-white' : 'bg-white text-black',
                  ].join(' ')}
                  style={{ flexGrow: k.span ?? 1, flexBasis: 0 }}
                >
                  {k.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <p className="text-[8px] leading-none">Press a key. It lights up.</p>
    </div>
  );
}
