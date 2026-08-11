/**
 * The Calculator desk accessory's arithmetic, as a pure reducer.
 *
 * OWNER: Classic Boot agent.
 *
 * Four functions and nothing else, the way the 1984 one worked: no memory, no
 * parentheses, no operator precedence — an operator key commits whatever is
 * pending and starts collecting the next operand. Keeping it pure means the
 * keypad and the keyboard drive exactly the same machine.
 */

export type CalcOp = '+' | '-' | '×' | '÷';

export interface CalcState {
  /** What is on the readout right now. */
  display: string;
  /** Left-hand operand of the pending operation. */
  accumulator: number | null;
  /** Operator waiting for its right-hand operand. */
  pending: CalcOp | null;
  /** True when the next digit should start a fresh number. */
  fresh: boolean;
  /** Overflow or divide-by-zero: the readout is showing "Error". */
  error: boolean;
}

export type CalcAction =
  | { type: 'digit'; value: string }
  | { type: 'decimal' }
  | { type: 'op'; op: CalcOp }
  | { type: 'equals' }
  | { type: 'sign' }
  | { type: 'back' }
  | { type: 'clear' };

/** A 1984 readout is narrow. Refuse input past this rather than scrolling. */
const MAX_DIGITS = 11;

export const INITIAL_CALC: CalcState = {
  display: '0',
  accumulator: null,
  pending: null,
  fresh: true,
  error: false,
};

export const ERROR_DISPLAY = 'Error';

/** Trim binary-float noise (0.1 + 0.2) without lying about big numbers. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return ERROR_DISPLAY;
  if (n === 0) return '0';

  const rounded = Number(n.toPrecision(12));
  const plain = String(rounded);
  if (plain.length <= MAX_DIGITS + 1) return plain;

  const exp = rounded.toExponential(5).replace('e+', 'e');
  return exp.length < plain.length ? exp : plain.slice(0, MAX_DIGITS + 1);
}

function apply(a: number, op: CalcOp, b: number): number {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '×':
      return a * b;
    case '÷':
      // Infinity flows straight into the error branch below.
      return a / b;
  }
}

/** Digits currently entered, ignoring sign and decimal point. */
function digitCount(display: string): number {
  return display.replace(/[-.]/g, '').length;
}

export function calcReducer(state: CalcState, action: CalcAction): CalcState {
  // Any key clears an error except the operators, which would be meaningless.
  if (state.error && action.type !== 'clear') {
    if (action.type === 'digit' || action.type === 'decimal') {
      return calcReducer(INITIAL_CALC, action);
    }
    return state;
  }

  switch (action.type) {
    case 'clear':
      return INITIAL_CALC;

    case 'digit': {
      if (state.fresh) {
        return { ...state, display: action.value, fresh: false };
      }
      if (state.display === '0') return { ...state, display: action.value };
      if (state.display === '-0') return { ...state, display: `-${action.value}` };
      if (digitCount(state.display) >= MAX_DIGITS) return state;
      return { ...state, display: state.display + action.value };
    }

    case 'decimal': {
      if (state.fresh) return { ...state, display: '0.', fresh: false };
      if (state.display.includes('.')) return state;
      return { ...state, display: `${state.display}.` };
    }

    case 'sign': {
      if (state.display === '0') return state;
      const flipped = state.display.startsWith('-')
        ? state.display.slice(1)
        : `-${state.display}`;
      return { ...state, display: flipped };
    }

    case 'back': {
      if (state.fresh) return state;
      const next = state.display.slice(0, -1);
      if (next === '' || next === '-') return { ...state, display: '0', fresh: true };
      return { ...state, display: next };
    }

    case 'op': {
      // Pressing two operators in a row just changes the pending one.
      if (state.fresh && state.pending !== null) {
        return { ...state, pending: action.op };
      }
      const current = Number(state.display);
      const total =
        state.pending !== null && state.accumulator !== null
          ? apply(state.accumulator, state.pending, current)
          : current;
      const error = !Number.isFinite(total);
      return {
        display: error ? ERROR_DISPLAY : formatNumber(total),
        accumulator: error ? null : total,
        pending: error ? null : action.op,
        fresh: true,
        error,
      };
    }

    case 'equals': {
      if (state.pending === null || state.accumulator === null) {
        return { ...state, fresh: true };
      }
      const total = apply(state.accumulator, state.pending, Number(state.display));
      const error = !Number.isFinite(total);
      return {
        display: error ? ERROR_DISPLAY : formatNumber(total),
        accumulator: null,
        pending: null,
        fresh: true,
        error,
      };
    }
  }
}

/**
 * Map a physical key to a calculator action, or null if the key isn't ours —
 * so the window can leave everything else alone.
 */
export function actionForKey(key: string): CalcAction | null {
  if (key >= '0' && key <= '9') return { type: 'digit', value: key };
  switch (key) {
    case '.':
    case ',':
      return { type: 'decimal' };
    case '+':
      return { type: 'op', op: '+' };
    case '-':
      return { type: 'op', op: '-' };
    case '*':
    case 'x':
    case 'X':
      return { type: 'op', op: '×' };
    case '/':
      return { type: 'op', op: '÷' };
    case '=':
    case 'Enter':
      return { type: 'equals' };
    case 'Backspace':
      return { type: 'back' };
    case 'Escape':
    case 'c':
    case 'C':
      return { type: 'clear' };
    case 'n':
    case 'N':
      return { type: 'sign' };
    default:
      return null;
  }
}
