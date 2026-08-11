/**
 * Browser-side wrapper around POST /api/terminal.
 *
 * The route never throws for a missing key or an upstream failure — it answers
 * 200 with `offline: true` and an in-character line. This wrapper only has to
 * handle the case where the request itself never lands (dev server down,
 * offline browser), and it degrades the same way.
 *
 * OWNER: Terminal agent.
 */
import { terminalPersona } from '@/content/terminal';
import type { ChatTurn, TerminalReply } from './types';

/** How many past turns we bother sending. The server caps this again. */
const HISTORY_LIMIT = 8;

/** Local fallback so the terminal stays in character even with no network. */
export function offlineReply(): string {
  const pool = terminalPersona.offlineReplies;
  if (pool.length === 0) return 'NO CARRIER.';
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function askAssistant(
  input: string,
  history: ChatTurn[],
  signal?: AbortSignal,
): Promise<TerminalReply> {
  try {
    const res = await fetch('/api/terminal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input, history: history.slice(-HISTORY_LIMIT) }),
      signal,
    });

    const data: unknown = await res.json().catch(() => null);
    if (data && typeof data === 'object' && 'reply' in data) {
      const { reply, offline } = data as { reply: unknown; offline?: unknown };
      if (typeof reply === 'string' && reply.trim()) {
        return { reply: reply.trim(), offline: offline === true };
      }
    }
    return { reply: offlineReply(), offline: true };
  } catch {
    // Aborted, offline, or the route is not running. Same in-character exit.
    return { reply: offlineReply(), offline: true };
  }
}
