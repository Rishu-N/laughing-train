'use client';

/**
 * Calculator — a working four-function desk accessory.
 *
 * OWNER: Classic Boot agent.
 *
 * The arithmetic lives in lib/classic/calculator.ts as a pure reducer, so the
 * chunky keypad and the physical keyboard drive exactly the same machine and
 * cannot drift apart. Number keys, + - * /, Enter/=, Backspace and Escape all
 * work; Escape stops propagating so it clears the readout instead of closing
 * the window.
 */
import { useEffect, useReducer, useRef, useState, type KeyboardEvent } from 'react';
import { BIT_FONT, BitKey } from '@/components/classic/ui/Bit';
import {
  actionForKey,
  calcReducer,
  INITIAL_CALC,
  type CalcAction,
} from '@/lib/classic/calculator';

interface KeyDef {
  id: string;
  label: string;
  action: CalcAction;
  /** Extra grid placement classes. */
  span?: string;
}

const KEYS: KeyDef[] = [
  { id: 'clear', label: 'C', action: { type: 'clear' } },
  { id: 'sign', label: '±', action: { type: 'sign' } },
  { id: 'divide', label: '÷', action: { type: 'op', op: '÷' } },
  { id: 'times', label: '×', action: { type: 'op', op: '×' } },

  { id: '7', label: '7', action: { type: 'digit', value: '7' } },
  { id: '8', label: '8', action: { type: 'digit', value: '8' } },
  { id: '9', label: '9', action: { type: 'digit', value: '9' } },
  { id: 'minus', label: '−', action: { type: 'op', op: '-' } },

  { id: '4', label: '4', action: { type: 'digit', value: '4' } },
  { id: '5', label: '5', action: { type: 'digit', value: '5' } },
  { id: '6', label: '6', action: { type: 'digit', value: '6' } },
  { id: 'plus', label: '+', action: { type: 'op', op: '+' } },

  { id: '1', label: '1', action: { type: 'digit', value: '1' } },
  { id: '2', label: '2', action: { type: 'digit', value: '2' } },
  { id: '3', label: '3', action: { type: 'digit', value: '3' } },
  { id: 'equals', label: '=', action: { type: 'equals' }, span: 'row-span-2' },

  { id: '0', label: '0', action: { type: 'digit', value: '0' }, span: 'col-span-2' },
  { id: 'dot', label: '.', action: { type: 'decimal' } },
];

/** Spoken labels for the glyphs, so the keypad isn't a wall of symbols. */
const KEY_NAMES: Record<string, string> = {
  clear: 'Clear',
  sign: 'Change sign',
  divide: 'Divide',
  times: 'Multiply',
  minus: 'Subtract',
  plus: 'Add',
  equals: 'Equals',
  dot: 'Decimal point',
};

export default function Calculator() {
  const [state, dispatch] = useReducer(calcReducer, INITIAL_CALC);
  /** Which key the physical keyboard is lighting up right now. */
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const action = actionForKey(e.key);
    if (!action) return;

    e.preventDefault();
    // Escape means Clear in here, so the window must not also close.
    e.stopPropagation();
    dispatch(action);

    const hit = KEYS.find(
      (k) => JSON.stringify(k.action) === JSON.stringify(action),
    );
    if (hit) {
      setFlash(hit.id);
      window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlash(null), 90);
    }
  };

  return (
    <div
      className={`${BIT_FONT} flex h-full flex-col gap-2 bg-white p-2 text-black`}
      onKeyDown={onKeyDown}
    >
      <output
        aria-live="polite"
        aria-label="Result"
        className="block truncate border border-black px-2 py-[6px] text-right text-[14px] leading-none"
      >
        {state.display}
      </output>

      {/* minmax() floors the key height so the pad stays thumb-sized even when
          the window is squeezed at phone width. */}
      <div
        className="grid min-h-0 flex-1 grid-cols-4 gap-[3px]"
        style={{ gridTemplateRows: 'repeat(5, minmax(30px, 1fr))' }}
      >
        {KEYS.map((key) => (
          <BitKey
            key={key.id}
            aria-label={KEY_NAMES[key.id]}
            pressed={flash === key.id}
            className={key.span ?? ''}
            onClick={() => dispatch(key.action)}
          >
            {key.label}
          </BitKey>
        ))}
      </div>

      <p className="text-[8px] leading-none">Keyboard works too.</p>
    </div>
  );
}
