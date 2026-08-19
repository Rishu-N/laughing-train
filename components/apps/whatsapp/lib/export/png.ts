// PNG export — one tall image of the whole (filtered) conversation.
// Browsers cap canvas height (commonly ~16k-32k px depending on engine
// and available memory); past that this splits into row-aligned chunks
// — never cutting a message in half — and zips the numbered parts into
// one download.
import { zipSync, type Zippable } from "fflate";
import { measureLayout, paintRange, paintHeader, type Layout, type LayoutOptions } from "../layout/bubbles";
import type { ChatModel } from "../model";
import {
  preloadImages,
  revokeImages,
  canvasToBlob,
  downloadBlob,
  safeFileStem,
  checkCancelled,
  type CancelToken,
} from "./shared";

const CONTENT_WIDTH = 900;
const HEADER_H = 64;
const MAX_CHUNK_H = 15000; // conservative vs. browser canvas-height limits

export interface PngExportParams {
  model: ChatModel;
  start: number;
  end: number;
  meId: number;
  contactName: string;
  mediaBlobs: Map<string, Blob>;
  showTimestamps: boolean;
  showSenderName: boolean;
  onProgress?: (chunk: number, total: number) => void;
  cancelToken?: CancelToken;
}

/** Largest y <= target that lands exactly on a row boundary (a row's
 * y + height), found via binary search since layout.rows is y-ascending.
 * Guarantees a chunk split never slices a bubble in half. */
function findCutAtOrBefore(layout: Layout, target: number): number {
  const rows = layout.rows;
  let lo = 0;
  let hi = rows.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].y + rows[mid].height <= target) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans >= 0 ? rows[ans].y + rows[ans].height : target;
}

export async function exportPng(params: PngExportParams): Promise<void> {
  const { model, start, end, meId, contactName, mediaBlobs, showTimestamps, showSenderName, onProgress, cancelToken } = params;

  const images = await preloadImages(model, start, end, mediaBlobs);
  checkCancelled(cancelToken);

  const opts: LayoutOptions = { contentWidth: CONTENT_WIDTH, showTimestamps, showSenderName, images };
  const layout = measureLayout(model, start, end, meId, opts);

  const dateRange =
    end > start
      ? `${new Date(model.ts[start]).toLocaleDateString()} – ${new Date(model.ts[end - 1]).toLocaleDateString()}`
      : "";

  // Message-space chunk boundaries (0..layout.totalHeight). The first
  // chunk has less room since it also carries the header.
  const boundaries: number[] = [0];
  let budget = MAX_CHUNK_H - HEADER_H;
  let cur = 0;
  while (cur < layout.totalHeight) {
    let next = Math.min(cur + budget, layout.totalHeight);
    if (next < layout.totalHeight) {
      const cut = findCutAtOrBefore(layout, next);
      if (cut > cur) next = cut;
    }
    boundaries.push(next);
    cur = next;
    budget = MAX_CHUNK_H;
  }
  const chunkCount = boundaries.length - 1;

  try {
    const pngBlobs: Blob[] = [];
    for (let c = 0; c < chunkCount; c++) {
      checkCancelled(cancelToken);
      const y0 = boundaries[c];
      const y1 = boundaries[c + 1];
      const msgH = y1 - y0;
      const isFirst = c === 0;
      const canvas = document.createElement("canvas");
      canvas.width = CONTENT_WIDTH;
      canvas.height = Math.ceil(msgH + (isFirst ? HEADER_H : 0));
      const ctx = canvas.getContext("2d")!;

      if (isFirst) {
        paintHeader(ctx, CONTENT_WIDTH, contactName, dateRange, HEADER_H);
        ctx.save();
        ctx.translate(0, HEADER_H);
        paintRange(ctx, layout, model, meId, opts, y0, msgH);
        ctx.restore();
      } else {
        paintRange(ctx, layout, model, meId, opts, y0, msgH);
      }

      pngBlobs.push(await canvasToBlob(canvas, "image/png"));
      onProgress?.(c + 1, chunkCount);
      await new Promise((r) => setTimeout(r, 0));
    }

    const stem = safeFileStem(contactName);
    if (pngBlobs.length === 1) {
      downloadBlob(pngBlobs[0], `${stem}.png`);
      return;
    }

    const files: Zippable = {};
    for (let i = 0; i < pngBlobs.length; i++) {
      const bytes = new Uint8Array(await pngBlobs[i].arrayBuffer());
      const name = `${stem}-part-${i + 1}-of-${pngBlobs.length}.png`;
      files[name] = [bytes, { level: 0 }]; // already-compressed PNG data
    }
    const zipped = zipSync(files);
    downloadBlob(new Blob([zipped as BlobPart], { type: "application/zip" }), `${stem}.zip`);
  } finally {
    revokeImages(images);
  }
}
