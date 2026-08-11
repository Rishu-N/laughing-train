/**
 * Formula engine: tokenizer, recursive-descent parser, evaluator.
 *
 * There is deliberately no `eval` and no `new Function` anywhere in this file —
 * a spreadsheet that pipes cell contents into a JS evaluator is a script
 * injection waiting to happen, and it cannot report useful errors either.
 *
 * Grammar:
 *
 *   expression := term (('+' | '-') term)*
 *   term       := unary (('*' | '/') unary)*
 *   unary      := ('-' | '+') unary | power
 *   power      := primary ('^' unary)?
 *   primary    := number | string | '(' expression ')' | call | reference
 *   call       := IDENT '(' (argument (',' argument)*)? ')'
 *   argument   := range | expression
 *   range      := REF ':' REF
 */

/* ------------------------------------------------------------------ types -- */

export type ErrorCode = '#ERROR' | '#DIV/0!' | '#CIRC!' | '#NAME?' | '#REF!';

export type CellValue =
  | { kind: 'empty' }
  | { kind: 'number'; n: number }
  | { kind: 'text'; s: string }
  | { kind: 'error'; code: ErrorCode };

export const EMPTY_VALUE: CellValue = { kind: 'empty' };

/** Raw cell contents keyed by A1-style address. Absent key == empty cell. */
export type CellMap = Record<string, string>;

class FormulaError extends Error {
  code: ErrorCode;
  constructor(code: ErrorCode) {
    super(code);
    this.code = code;
  }
}

/* ------------------------------------------------------------ addressing -- */

export const COLUMN_COUNT = 26;
export const ROW_COUNT = 50;

/** 0 -> "A", 25 -> "Z", 26 -> "AA". */
export function columnLabel(index: number): string {
  let n = index;
  let label = '';
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

export function columnIndex(label: string): number {
  let n = 0;
  for (const ch of label.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

export function cellId(col: number, row: number): string {
  return `${columnLabel(col)}${row + 1}`;
}

/** "B7" -> { col: 1, row: 6 }. Returns null for anything not an address. */
export function parseCellId(id: string): { col: number; row: number } | null {
  const m = /^([A-Za-z]{1,3})([0-9]{1,5})$/.exec(id.trim());
  if (!m) return null;
  const row = Number(m[2]) - 1;
  if (row < 0) return null;
  return { col: columnIndex(m[1]), row };
}

/* -------------------------------------------------------------- tokenizer -- */

type Token =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'ref'; v: string }
  | { t: 'ident'; v: string }
  | { t: 'punct'; v: string };

const PUNCT = new Set(['+', '-', '*', '/', '^', '(', ')', ',', ':', '%', '&']);

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i += 1;
      continue;
    }

    if (ch >= '0' && ch <= '9') {
      let j = i;
      while (j < input.length && input[j] >= '0' && input[j] <= '9') j += 1;
      if (input[j] === '.') {
        j += 1;
        while (j < input.length && input[j] >= '0' && input[j] <= '9') j += 1;
      }
      tokens.push({ t: 'num', v: Number(input.slice(i, j)) });
      i = j;
      continue;
    }

    if (ch === '.') {
      let j = i + 1;
      while (j < input.length && input[j] >= '0' && input[j] <= '9') j += 1;
      if (j === i + 1) throw new FormulaError('#ERROR');
      tokens.push({ t: 'num', v: Number(input.slice(i, j)) });
      i = j;
      continue;
    }

    if (ch === '"') {
      let j = i + 1;
      let out = '';
      while (j < input.length && input[j] !== '"') {
        out += input[j];
        j += 1;
      }
      if (j >= input.length) throw new FormulaError('#ERROR');
      tokens.push({ t: 'str', v: out });
      i = j + 1;
      continue;
    }

    if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      // `$` is accepted and ignored so pasted absolute refs ($A$1) still work.
      while (j < input.length && /[A-Za-z0-9_.$]/.test(input[j])) j += 1;
      const word = input.slice(i, j).replace(/\$/g, '');
      i = j;
      if (parseCellId(word)) tokens.push({ t: 'ref', v: word.toUpperCase() });
      else tokens.push({ t: 'ident', v: word.toUpperCase() });
      continue;
    }

    if (PUNCT.has(ch)) {
      tokens.push({ t: 'punct', v: ch });
      i += 1;
      continue;
    }

    throw new FormulaError('#ERROR');
  }

  return tokens;
}

/* ------------------------------------------------------------------- ast -- */

export type Node =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'ref'; v: string }
  | { k: 'range'; from: string; to: string }
  | { k: 'unary'; op: '-' | '+'; e: Node }
  | { k: 'binary'; op: '+' | '-' | '*' | '/' | '^' | '&'; l: Node; r: Node }
  | { k: 'call'; name: string; args: Node[] };

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private eatPunct(v: string): boolean {
    const tk = this.peek();
    if (tk && tk.t === 'punct' && tk.v === v) {
      this.pos += 1;
      return true;
    }
    return false;
  }

  private expectPunct(v: string): void {
    if (!this.eatPunct(v)) throw new FormulaError('#ERROR');
  }

  parseProgram(): Node {
    const node = this.parseExpression();
    if (this.pos !== this.tokens.length) throw new FormulaError('#ERROR');
    return node;
  }

  private parseExpression(): Node {
    let left = this.parseTerm();
    for (;;) {
      const tk = this.peek();
      if (tk && tk.t === 'punct' && (tk.v === '+' || tk.v === '-' || tk.v === '&')) {
        this.pos += 1;
        const right = this.parseTerm();
        left = { k: 'binary', op: tk.v as '+' | '-' | '&', l: left, r: right };
        continue;
      }
      return left;
    }
  }

  private parseTerm(): Node {
    let left = this.parseUnary();
    for (;;) {
      const tk = this.peek();
      if (tk && tk.t === 'punct' && (tk.v === '*' || tk.v === '/')) {
        this.pos += 1;
        const right = this.parseUnary();
        left = { k: 'binary', op: tk.v as '*' | '/', l: left, r: right };
        continue;
      }
      return left;
    }
  }

  private parseUnary(): Node {
    const tk = this.peek();
    if (tk && tk.t === 'punct' && (tk.v === '-' || tk.v === '+')) {
      this.pos += 1;
      return { k: 'unary', op: tk.v as '-' | '+', e: this.parseUnary() };
    }
    return this.parsePower();
  }

  private parsePower(): Node {
    const base = this.parsePrimary();
    const tk = this.peek();
    if (tk && tk.t === 'punct' && tk.v === '^') {
      this.pos += 1;
      return { k: 'binary', op: '^', l: base, r: this.parseUnary() };
    }
    return base;
  }

  private parsePrimary(): Node {
    const tk = this.peek();
    if (!tk) throw new FormulaError('#ERROR');

    if (tk.t === 'num') {
      this.pos += 1;
      // Trailing % scales the literal, as in a real sheet.
      if (this.eatPunct('%')) return { k: 'num', v: tk.v / 100 };
      return { k: 'num', v: tk.v };
    }

    if (tk.t === 'str') {
      this.pos += 1;
      return { k: 'str', v: tk.v };
    }

    if (tk.t === 'punct' && tk.v === '(') {
      this.pos += 1;
      const inner = this.parseExpression();
      this.expectPunct(')');
      return inner;
    }

    if (tk.t === 'ref') {
      this.pos += 1;
      const next = this.peek();
      if (next && next.t === 'punct' && next.v === ':') {
        const after = this.tokens[this.pos + 1];
        if (!after || after.t !== 'ref') throw new FormulaError('#REF!');
        this.pos += 2;
        return { k: 'range', from: tk.v, to: after.v };
      }
      return { k: 'ref', v: tk.v };
    }

    if (tk.t === 'ident') {
      this.pos += 1;
      if (!this.eatPunct('(')) throw new FormulaError('#NAME?');
      const args: Node[] = [];
      if (!this.eatPunct(')')) {
        for (;;) {
          args.push(this.parseExpression());
          if (this.eatPunct(',')) continue;
          this.expectPunct(')');
          break;
        }
      }
      return { k: 'call', name: tk.v, args };
    }

    throw new FormulaError('#ERROR');
  }
}

export function parseFormula(source: string): Node {
  return new Parser(tokenize(source)).parseProgram();
}

/* ------------------------------------------------------------- evaluation -- */

type Resolver = (ref: string) => CellValue;

function expandRange(from: string, to: string): string[] {
  const a = parseCellId(from);
  const b = parseCellId(to);
  if (!a || !b) throw new FormulaError('#REF!');
  const out: string[] = [];
  const c0 = Math.min(a.col, b.col);
  const c1 = Math.max(a.col, b.col);
  const r0 = Math.min(a.row, b.row);
  const r1 = Math.max(a.row, b.row);
  // A guard rail: a runaway range should error rather than lock up the tab.
  if ((c1 - c0 + 1) * (r1 - r0 + 1) > 20_000) throw new FormulaError('#REF!');
  for (let r = r0; r <= r1; r += 1) {
    for (let c = c0; c <= c1; c += 1) out.push(cellId(c, r));
  }
  return out;
}

/** Every scalar produced by a node, flattening ranges. Errors propagate. */
function flatten(node: Node, resolve: Resolver): CellValue[] {
  if (node.k === 'range') {
    return expandRange(node.from, node.to).map((ref) => {
      const v = resolve(ref);
      if (v.kind === 'error') throw new FormulaError(v.code);
      return v;
    });
  }
  return [evaluateNode(node, resolve)];
}

function toNumber(v: CellValue): number {
  switch (v.kind) {
    case 'empty':
      return 0;
    case 'number':
      return v.n;
    case 'error':
      throw new FormulaError(v.code);
    case 'text': {
      const trimmed = v.s.trim();
      if (trimmed === '') return 0;
      const n = Number(trimmed);
      if (!Number.isFinite(n)) throw new FormulaError('#ERROR');
      return n;
    }
  }
}

function toText(v: CellValue): string {
  switch (v.kind) {
    case 'empty':
      return '';
    case 'number':
      return String(v.n);
    case 'text':
      return v.s;
    case 'error':
      throw new FormulaError(v.code);
  }
}

/** Numeric arguments only — text and blanks are skipped, as in a real sheet. */
function numericArgs(args: Node[], resolve: Resolver): number[] {
  const out: number[] = [];
  for (const arg of args) {
    for (const v of flatten(arg, resolve)) {
      if (v.kind === 'number') out.push(v.n);
      else if (v.kind === 'error') throw new FormulaError(v.code);
      else if (v.kind === 'text') {
        const n = Number(v.s.trim());
        if (v.s.trim() !== '' && Number.isFinite(n)) out.push(n);
      }
    }
  }
  return out;
}

const FUNCTIONS: Record<string, (args: Node[], resolve: Resolver) => CellValue> = {
  SUM: (args, resolve) => ({
    kind: 'number',
    n: numericArgs(args, resolve).reduce((a, b) => a + b, 0),
  }),
  AVG: (args, resolve) => {
    const ns = numericArgs(args, resolve);
    if (ns.length === 0) throw new FormulaError('#DIV/0!');
    return { kind: 'number', n: ns.reduce((a, b) => a + b, 0) / ns.length };
  },
  MIN: (args, resolve) => {
    const ns = numericArgs(args, resolve);
    return { kind: 'number', n: ns.length === 0 ? 0 : Math.min(...ns) };
  },
  MAX: (args, resolve) => {
    const ns = numericArgs(args, resolve);
    return { kind: 'number', n: ns.length === 0 ? 0 : Math.max(...ns) };
  },
  COUNT: (args, resolve) => ({ kind: 'number', n: numericArgs(args, resolve).length }),
  ABS: (args, resolve) => {
    if (args.length !== 1) throw new FormulaError('#ERROR');
    return { kind: 'number', n: Math.abs(toNumber(evaluateNode(args[0], resolve))) };
  },
  ROUND: (args, resolve) => {
    if (args.length < 1 || args.length > 2) throw new FormulaError('#ERROR');
    const n = toNumber(evaluateNode(args[0], resolve));
    const digits = args.length === 2 ? Math.trunc(toNumber(evaluateNode(args[1], resolve))) : 0;
    const factor = 10 ** Math.max(-10, Math.min(10, digits));
    return { kind: 'number', n: Math.round(n * factor) / factor };
  },
};
FUNCTIONS.AVERAGE = FUNCTIONS.AVG;

export const FUNCTION_NAMES = ['SUM', 'AVG', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'ABS', 'ROUND'];

function evaluateNode(node: Node, resolve: Resolver): CellValue {
  switch (node.k) {
    case 'num':
      return { kind: 'number', n: node.v };
    case 'str':
      return { kind: 'text', s: node.v };
    case 'ref': {
      const v = resolve(node.v);
      if (v.kind === 'error') throw new FormulaError(v.code);
      return v;
    }
    case 'range': {
      // A bare range outside a function has no scalar meaning.
      throw new FormulaError('#ERROR');
    }
    case 'unary': {
      const n = toNumber(evaluateNode(node.e, resolve));
      return { kind: 'number', n: node.op === '-' ? -n : n };
    }
    case 'binary': {
      if (node.op === '&') {
        return {
          kind: 'text',
          s: toText(evaluateNode(node.l, resolve)) + toText(evaluateNode(node.r, resolve)),
        };
      }
      const l = toNumber(evaluateNode(node.l, resolve));
      const r = toNumber(evaluateNode(node.r, resolve));
      switch (node.op) {
        case '+':
          return { kind: 'number', n: l + r };
        case '-':
          return { kind: 'number', n: l - r };
        case '*':
          return { kind: 'number', n: l * r };
        case '/':
          if (r === 0) throw new FormulaError('#DIV/0!');
          return { kind: 'number', n: l / r };
        case '^': {
          const n = l ** r;
          if (!Number.isFinite(n)) throw new FormulaError('#ERROR');
          return { kind: 'number', n };
        }
      }
      throw new FormulaError('#ERROR');
    }
    case 'call': {
      const fn = FUNCTIONS[node.name];
      if (!fn) throw new FormulaError('#NAME?');
      return fn(node.args, resolve);
    }
  }
}

/* ----------------------------------------------------------------- sheet -- */

/** Parse a raw cell string into a value, without following references. */
function literalValue(raw: string): CellValue {
  const trimmed = raw.trim();
  if (trimmed === '') return EMPTY_VALUE;
  // Accept "1,234.5" and "42%" as numbers the way a spreadsheet would.
  const percent = /^-?[\d,]*\.?\d+%$/.test(trimmed);
  const numeric = percent ? trimmed.slice(0, -1) : trimmed;
  if (/^-?[\d,]*\.?\d+$/.test(numeric)) {
    const n = Number(numeric.replace(/,/g, ''));
    if (Number.isFinite(n)) return { kind: 'number', n: percent ? n / 100 : n };
  }
  return { kind: 'text', s: raw };
}

export interface Sheet {
  /** Computed value of one cell. */
  valueOf(ref: string): CellValue;
}

/**
 * Build an evaluator over a cell map.
 *
 * Results are memoised per sheet instance, and a `visiting` set catches cycles:
 * A1 = B1, B1 = A1 resolves to #CIRC! instead of recursing until the stack dies.
 * This is the part it is fatal to skip — an undetected cycle hangs the tab.
 */
export function createSheet(cells: CellMap): Sheet {
  const cache = new Map<string, CellValue>();
  const visiting = new Set<string>();

  function valueOf(rawRef: string): CellValue {
    const ref = rawRef.toUpperCase();
    const cached = cache.get(ref);
    if (cached) return cached;

    if (visiting.has(ref)) return { kind: 'error', code: '#CIRC!' };

    const raw = cells[ref];
    if (raw === undefined || raw === '') {
      cache.set(ref, EMPTY_VALUE);
      return EMPTY_VALUE;
    }

    if (!raw.startsWith('=')) {
      const literal = literalValue(raw);
      cache.set(ref, literal);
      return literal;
    }

    visiting.add(ref);
    let result: CellValue;
    try {
      result = evaluateNode(parseFormula(raw.slice(1)), valueOf);
      if (result.kind === 'number' && !Number.isFinite(result.n)) {
        result = { kind: 'error', code: '#ERROR' };
      }
    } catch (err) {
      result =
        err instanceof FormulaError
          ? { kind: 'error', code: err.code }
          : { kind: 'error', code: '#ERROR' };
    } finally {
      visiting.delete(ref);
    }

    cache.set(ref, result);
    return result;
  }

  return { valueOf };
}

/* -------------------------------------------------------------- display -- */

const MAX_DECIMALS = 10;

/** What actually gets painted in the cell. */
export function formatValue(v: CellValue): string {
  switch (v.kind) {
    case 'empty':
      return '';
    case 'text':
      return v.s;
    case 'error':
      return v.code;
    case 'number': {
      if (Number.isInteger(v.n)) return String(v.n);
      const rounded = Number(v.n.toFixed(MAX_DECIMALS));
      return String(rounded);
    }
  }
}

/** Numbers right-align, everything else left-aligns. */
export function alignmentFor(v: CellValue): 'left' | 'right' {
  return v.kind === 'number' ? 'right' : 'left';
}
