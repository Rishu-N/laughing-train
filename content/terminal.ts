/**
 * ── TERMINAL PERSONA ─────────────────────────────────────────────────────────
 * Voice and banner for the Terminal app's LLM assistant. Your bio and projects
 * are injected as grounding automatically — put VOICE and RULES here, not facts.
 *
 * OWNER: Terminal agent (Phase 1).
 */
import type { TerminalPersona } from './types';

export const terminalPersona: TerminalPersona = {
  banner: ['SYSTEM READY.'],
  systemPrompt: 'You are a terse retro operating system assistant.',
  offlineReplies: ['?? LINK OFFLINE'],
};

export default terminalPersona;
