// Messages are chronological (WhatsApp exports always are), so narrowing
// to a date/time range is a binary search over `ts`, not a filter pass —
// O(log n) instead of O(n), which is what makes dragging the Settings
// range sliders feel instant even at hundreds of thousands of messages.
import type { ChatModel } from "./model";

export interface Range {
  /** Inclusive start index into the model's columns. */
  start: number;
  /** Exclusive end index. */
  end: number;
}

/** First index with ts[i] >= target. */
function lowerBound(ts: Float64Array, target: number): number {
  let lo = 0;
  let hi = ts.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (ts[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** First index with ts[i] > target. */
function upperBound(ts: Float64Array, target: number): number {
  let lo = 0;
  let hi = ts.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (ts[mid] <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Returns the [start, end) index range covering messages with
 * startMs <= ts <= endMs. Pass undefined for either bound to leave that
 * side open.
 */
export function selectRange(model: ChatModel, startMs?: number, endMs?: number): Range {
  const start = startMs === undefined ? 0 : lowerBound(model.ts, startMs);
  const end = endMs === undefined ? model.count : upperBound(model.ts, endMs);
  return { start: Math.min(start, model.count), end: Math.max(end, start) };
}

export const FULL_RANGE = (model: ChatModel): Range => ({ start: 0, end: model.count });

/** Clips a sorted-ascending index array (e.g. search hits) to a [start,
 * end) message range, via binary search on both ends rather than a
 * linear filter — matters when a chat has thousands of hits. */
export function clipSortedToRange(indices: Uint32Array, start: number, end: number): Uint32Array {
  if (indices.length === 0) return indices;
  let lo = 0;
  let hi = indices.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (indices[mid] < start) lo = mid + 1;
    else hi = mid;
  }
  const from = lo;
  hi = indices.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (indices[mid] < end) lo = mid + 1;
    else hi = mid;
  }
  return indices.subarray(from, lo);
}
