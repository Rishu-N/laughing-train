// Stitches multiple WhatsApp exports of the *same* conversation into one
// continuous, deduplicated timeline. This is needed because WhatsApp's own
// export is a sliding window (capped around 40k text-only / 10k with
// media) — a long-running chat can only be captured by exporting more than
// once over time, producing several .zip files whose date ranges overlap,
// have gaps, or both.
//
// Correctness rests on one fact: WhatsApp re-exports historical messages
// byte-identical every time. So two "real" copies of the same message
// (same second, same sender, same type, same text, same attached
// filename) always collide on that key — no fuzzy matching needed, no
// message IDs required (the export format doesn't have any).
import { ChatModelBuilder, MsgType, NO_SENDER, type ChatModel } from "../model";

export interface MergeStats {
  sourceCount: number;
  /** Sum of message counts across all sources before dedup. */
  totalInput: number;
  uniqueOutput: number;
  duplicatesRemoved: number;
  /** Set when the sources share few or no participants — likely not the
   * same conversation, merged anyway but worth surfacing to the user. */
  warning?: string;
}

interface Row {
  ts: number;
  senderId: number;
  type: number;
  flags: number;
  body: string;
  mediaKey: string | null;
  key: string;
  sourceIdx: number;
  origIdx: number;
}

function dedupKey(tsMs: number, senderId: number, type: number, body: string, mediaKey: string | null): string {
  // WhatsApp's export timestamp resolution is whole seconds.
  const tsSec = Math.round(tsMs / 1000);
  return tsSec + "|" + senderId + "|" + type + "|" + body + "|" + (mediaKey ?? "");
}

function participantOverlapWarning(sources: ChatModel[]): string | undefined {
  if (sources.length < 2) return undefined;
  const first = new Set(sources[0].senders.map((s) => s.toLowerCase()));
  for (let i = 1; i < sources.length; i++) {
    const other = new Set(sources[i].senders.map((s) => s.toLowerCase()));
    let shared = 0;
    for (const name of other) if (first.has(name)) shared++;
    if (shared === 0) {
      return "These exports don't share any participant names — check they're really the same conversation before relying on the merge.";
    }
  }
  return undefined;
}

/**
 * Merges N already-parsed exports of the same conversation into one
 * chronological, deduplicated ChatModel. A single source is returned
 * as-is (no copy) — merging is only meaningful for 2+.
 */
export function mergeModels(sources: ChatModel[]): { model: ChatModel; stats: MergeStats } {
  if (sources.length === 0) {
    const empty = new ChatModelBuilder().finish("DMY", false);
    return { model: empty, stats: { sourceCount: 0, totalInput: 0, uniqueOutput: 0, duplicatesRemoved: 0 } };
  }
  if (sources.length === 1) {
    const m = sources[0];
    return { model: m, stats: { sourceCount: 1, totalInput: m.count, uniqueOutput: m.count, duplicatesRemoved: 0 } };
  }

  // Reconcile senders across sources by exact display name — the same
  // contact is exported with the same name string every time.
  const senderNameToId = new Map<string, number>();
  const combinedSenders: string[] = [];
  function combinedIdFor(name: string): number {
    let id = senderNameToId.get(name);
    if (id === undefined) {
      id = combinedSenders.length;
      combinedSenders.push(name);
      senderNameToId.set(name, id);
    }
    return id;
  }
  const remap: number[][] = sources.map((src) => src.senders.map((name) => combinedIdFor(name)));

  const rows: Row[] = [];
  for (let s = 0; s < sources.length; s++) {
    const m = sources[s];
    for (let i = 0; i < m.count; i++) {
      const localSenderId = m.senderId[i];
      const senderId = localSenderId === NO_SENDER ? NO_SENDER : remap[s][localSenderId];
      const type = m.type[i];
      const body = m.bodies[i];
      const mediaKey = m.mediaKey[i];
      rows.push({
        ts: m.ts[i],
        senderId,
        type,
        flags: m.flags[i],
        body,
        mediaKey,
        key: dedupKey(m.ts[i], senderId, type, body, mediaKey),
        sourceIdx: s,
        origIdx: i,
      });
    }
  }

  // Cap emitted copies of each key at the *max* seen in any single
  // source, not the sum — a message genuinely repeated 3 times in one
  // export (sent 3x in the same second) shouldn't be tripled to 6 just
  // because a second export also captured all 3.
  const perSourceKeyCount: Map<string, number>[] = sources.map(() => new Map());
  for (const r of rows) {
    const map = perSourceKeyCount[r.sourceIdx];
    map.set(r.key, (map.get(r.key) ?? 0) + 1);
  }
  const maxAllowed = new Map<string, number>();
  for (const map of perSourceKeyCount) {
    for (const [k, c] of map) maxAllowed.set(k, Math.max(maxAllowed.get(k) ?? 0, c));
  }

  // Stable chronological merge; ties broken deterministically by source
  // order so re-running the merge is reproducible.
  rows.sort((a, b) => a.ts - b.ts || a.sourceIdx - b.sourceIdx || a.origIdx - b.origIdx);

  const builder = new ChatModelBuilder();
  builder.senders.push(...combinedSenders);
  const emitted = new Map<string, number>();
  for (const r of rows) {
    const already = emitted.get(r.key) ?? 0;
    const cap = maxAllowed.get(r.key) ?? 1;
    if (already >= cap) continue; // beyond the max seen in any one source — a real duplicate
    emitted.set(r.key, already + 1);
    builder.push(r.ts, r.senderId, r.type as MsgType, r.flags, r.body, r.mediaKey);
  }

  // Sources of the same conversation should agree on date order; take
  // the first source's reading as representative.
  const model = builder.finish(sources[0].dateOrder, sources[0].dateOrderCertain);
  const totalInput = rows.length;
  const stats: MergeStats = {
    sourceCount: sources.length,
    totalInput,
    uniqueOutput: model.count,
    duplicatesRemoved: totalInput - model.count,
    warning: participantOverlapWarning(sources),
  };
  return { model, stats };
}
