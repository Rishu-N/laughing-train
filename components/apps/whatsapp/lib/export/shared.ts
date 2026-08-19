// Helpers shared by the PDF, PNG, and HTML exporters.
import { Flag, MsgType, type ChatModel } from "../model";

/** Loads the real image files a [start,end) range will need to paint —
 * only IMAGE and file-backed STICKER rows draw an actual bitmap, every
 * other media type is always a placeholder tile even when a file exists
 * (video/audio/documents aren't representable as a static image). Object
 * URLs are cached on the returned map's images and must be revoked by
 * the caller via `revokeImages` once painting is done. */
export async function preloadImages(
  model: ChatModel,
  start: number,
  end: number,
  mediaBlobs: Map<string, Blob>,
): Promise<Map<string, HTMLImageElement>> {
  const out = new Map<string, HTMLImageElement>();
  const waits: Promise<void>[] = [];

  for (let i = start; i < end; i++) {
    const type = model.type[i];
    if (type !== MsgType.IMAGE && type !== MsgType.STICKER) continue;
    if ((model.flags[i] & Flag.HAS_FILE) === 0) continue;
    const key = model.mediaKey[i];
    if (!key || out.has(key)) continue;
    const blob = mediaBlobs.get(key);
    if (!blob) continue;

    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.src = url;
    out.set(key, img);
    waits.push(
      new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve(); // a broken file shouldn't block the whole export
      }),
    );
  }

  await Promise.all(waits);
  return out;
}

export function revokeImages(images: Map<string, HTMLImageElement>) {
  for (const img of images.values()) URL.revokeObjectURL(img.src);
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob returned null"))),
      type,
      quality,
    );
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Deferred revoke — some browsers cancel the download if the URL dies
  // immediately after the synchronous click().
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function safeFileStem(name: string): string {
  return name.replace(/[^\w\-. ]+/g, "_").trim() || "chat";
}

export class ExportCancelled extends Error {
  constructor() {
    super("Export cancelled");
    this.name = "ExportCancelled";
  }
}

export interface CancelToken {
  cancelled: boolean;
}

export function checkCancelled(token: CancelToken | undefined) {
  if (token?.cancelled) throw new ExportCancelled();
}
