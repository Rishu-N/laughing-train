/**
 * Low-level pixel operations for Paint, kept out of the component so the React
 * side stays readable.
 */
import { sampleSwatch, type ResolvedSwatch } from './patterns';

/**
 * Scanline flood fill.
 *
 * The `seen` bitmap is what guarantees termination even when the fill colour
 * equals the colour being replaced — the naive "stop when the pixel already
 * matches the fill" test loops forever on patterned fills.
 */
export function floodFill(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  startX: number,
  startY: number,
  swatch: ResolvedSwatch,
  tolerance = 12,
): void {
  const sx = Math.floor(startX);
  const sy = Math.floor(startY);
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return;

  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const at = (x: number, y: number) => (y * width + x) * 4;

  const origin = at(sx, sy);
  const tr = data[origin];
  const tg = data[origin + 1];
  const tb = data[origin + 2];
  const ta = data[origin + 3];

  const matches = (x: number, y: number) => {
    const i = at(x, y);
    return (
      Math.abs(data[i] - tr) <= tolerance &&
      Math.abs(data[i + 1] - tg) <= tolerance &&
      Math.abs(data[i + 2] - tb) <= tolerance &&
      Math.abs(data[i + 3] - ta) <= tolerance
    );
  };

  const seen = new Uint8Array(width * height);
  const stack: number[] = [sx, sy];

  while (stack.length > 0) {
    const y = stack.pop() as number;
    const seedX = stack.pop() as number;
    if (y < 0 || y >= height) continue;

    let x = seedX;
    while (x >= 0 && !seen[y * width + x] && matches(x, y)) x -= 1;
    x += 1;

    let spanUp = false;
    let spanDown = false;
    while (x < width && !seen[y * width + x] && matches(x, y)) {
      seen[y * width + x] = 1;
      const [r, g, b] = sampleSwatch(swatch, x, y);
      const i = at(x, y);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;

      if (y > 0) {
        const up = !seen[(y - 1) * width + x] && matches(x, y - 1);
        if (up && !spanUp) {
          stack.push(x, y - 1);
          spanUp = true;
        } else if (!up) {
          spanUp = false;
        }
      }
      if (y < height - 1) {
        const down = !seen[(y + 1) * width + x] && matches(x, y + 1);
        if (down && !spanDown) {
          stack.push(x, y + 1);
          spanDown = true;
        } else if (!down) {
          spanDown = false;
        }
      }
      x += 1;
    }
  }

  ctx.putImageData(image, 0, 0);
}

/**
 * Map a pointer event to canvas pixel coordinates.
 *
 * The canvas backing store is a fixed logical size and CSS scales it (with
 * `image-rendering: pixelated`), so the ratio between the element's rendered
 * box and its intrinsic size is exactly the factor to divide by. Doing this
 * from `offsetX`/`offsetY` — or assuming devicePixelRatio — is the classic
 * source of "the stroke lands away from the cursor" bugs.
 */
export function toCanvasPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width === 0 ? 1 : canvas.width / rect.width;
  const scaleY = rect.height === 0 ? 1 : canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

/** Normalise a drag into a positive-extent rectangle clamped to the canvas. */
export function normalizeRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  const left = Math.max(0, Math.min(Math.floor(Math.min(x0, x1)), width));
  const top = Math.max(0, Math.min(Math.floor(Math.min(y0, y1)), height));
  const right = Math.max(0, Math.min(Math.ceil(Math.max(x0, x1)), width));
  const bottom = Math.max(0, Math.min(Math.ceil(Math.max(y0, y1)), height));
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/**
 * PNG data URL small enough to sit in localStorage. Full size first; if that is
 * too big for comfort we re-encode at half resolution and let the loader scale
 * it back up (the art is pixel art, so the loss reads as style).
 */
export function toStorableDataUrl(
  canvas: HTMLCanvasElement,
  budget = 600_000,
): string {
  const full = canvas.toDataURL('image/png');
  if (full.length <= budget) return full;

  const small = document.createElement('canvas');
  small.width = Math.max(1, Math.round(canvas.width / 2));
  small.height = Math.max(1, Math.round(canvas.height / 2));
  const ctx = small.getContext('2d');
  if (!ctx) return full;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, small.width, small.height);
  const halved = small.toDataURL('image/png');
  return halved.length < full.length ? halved : full;
}

/** Load a data/asset URL and draw it stretched across the whole canvas. */
export function drawImageUrl(
  ctx: CanvasRenderingContext2D,
  url: string,
  width: number,
  height: number,
): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, width, height);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = url;
  });
}

/**
 * Draw a small pixel image centred on the canvas at the largest whole-number
 * scale that fits the given fraction of the surface, so it stays crisp.
 */
export function drawPortrait(
  ctx: CanvasRenderingContext2D,
  url: string,
  width: number,
  height: number,
  coverage = 0.7,
): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxW = width * coverage;
      const maxH = height * coverage;
      const raw = Math.min(maxW / img.width, maxH / img.height);
      const scale = raw >= 1 ? Math.max(1, Math.floor(raw)) : raw;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, Math.round((width - w) / 2), Math.round((height - h) / 2), w, h);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = url;
  });
}
