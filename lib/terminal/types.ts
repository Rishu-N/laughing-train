/**
 * Shared types for the Terminal app's local command layer.
 *
 * OWNER: Terminal agent.
 */

/** Visual/semantic class of one scrollback line. */
export type LineKind =
  /** Machine voice: banner, help, command output headers. */
  | 'system'
  /** Echo of what the user typed, with the prompt glyph. */
  | 'input'
  /** Normal command output. */
  | 'output'
  /** Something went wrong. Rendered in the warning colour. */
  | 'error'
  /** A reply from the LLM assistant. */
  | 'ai'
  /** Placeholder shown while the assistant is thinking. */
  | 'pending';

/** One line in the scrollback buffer. */
export interface TerminalLine {
  id: number;
  kind: LineKind;
  text: string;
}

/** A line a command wants to print. The id is assigned by the app. */
export interface OutputLine {
  kind: LineKind;
  text: string;
}

/** Everything a command is allowed to read about the session. */
export interface CommandContext {
  /** Previously submitted command strings, oldest first. */
  history: string[];
  /** Whether CRT effects are currently on. */
  crt: boolean;
}

/** What a command wants the app to do once it has run. */
export interface CommandOutcome {
  lines: OutputLine[];
  /** Wipe the scrollback. */
  clear?: boolean;
  /** Close the terminal window. */
  exit?: boolean;
  /** Change the CRT effect state. */
  crt?: 'on' | 'off' | 'toggle';
}

/** Result of parsing one submitted line. */
export type ParseResult =
  /** Nothing but whitespace — no-op. */
  | { type: 'blank' }
  /** A recognised local command, already executed. */
  | { type: 'command'; name: string; outcome: CommandOutcome }
  /** Not a known command: hand it to the assistant. */
  | { type: 'llm'; input: string };

/** One turn of conversation sent to the assistant for context. */
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Shape of a successful /api/terminal response. */
export interface TerminalReply {
  reply: string;
  /** True when the answer came from the canned offline pool, not the model. */
  offline?: boolean;
}
