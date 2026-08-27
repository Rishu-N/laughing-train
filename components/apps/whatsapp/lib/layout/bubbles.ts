// Shared measure+paint engine for the PDF and PNG exporters. Both go
// through canvas rather than the DOM (html2canvas would not survive a
// large chat, and pdf-lib can't embed colour-emoji fonts — canvas text
// rendering does that natively). Two-pass design: `measureLayout` walks
// the range once to compute every row's height and y-offset (cheap, pure
// text measurement), then `paintRange` can be called repeatedly for
// arbitrary y-slices — one call per PDF page, or one call per PNG chunk
// — without re-measuring.
import { MsgType, Flag, MEDIA_TYPES, type ChatModel } from "../model";
import { formatTime, formatDateDivider, colorForSender } from "../format";

export const COLORS = {
  chatBg: "#efeae2",
  headerBg: "#f0f2f5",
  panelBg: "#ffffff",
  bubbleIn: "#ffffff",
  bubbleOut: "#d9fdd3",
  bubbleSystem: "#fff2c7",
  textPrimary: "#111b21",
  textSecondary: "#667781",
  accent: "#00a884",
  danger: "#e15252",
  divider: "#d1d7db",
  shadow: "rgba(0,0,0,0.13)",
} as const;

const FONT_STACK = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
const FONT_BODY = `14.2px ${FONT_STACK}`;
const FONT_META = `11px ${FONT_STACK}`;
const FONT_SENDER = `600 13px ${FONT_STACK}`;
const FONT_DIVIDER = `12.5px ${FONT_STACK}`;
const FONT_HEADER_NAME = `600 16px ${FONT_STACK}`;
const FONT_HEADER_SUB = `12px ${FONT_STACK}`;
const LINE_HEIGHT = 19;
const BUBBLE_PAD_X = 10;
const BUBBLE_PAD_TOP = 7;
const BUBBLE_PAD_BOTTOM = 6;
const BUBBLE_RADIUS = 8;
const META_ROW_H = 15;
const PLACEHOLDER_TILE_H = 56;

export interface LayoutOptions {
  /** Full painted width, including side margins — e.g. an A4 page width
   * in px at the chosen scale, or a fixed PNG width. */
  contentWidth: number;
  showTimestamps: boolean;
  showSenderName: boolean;
  /** Mirrors the same switch in Settings. An export is meant to be the
   * document you were just looking at, so a reader who turned the
   * encryption notices off should not find them back in the PDF.
   * Defaults to showing them, which is what the live chat does. */
  showSystem?: boolean;
  /** Resolved real images, keyed by the model's mediaKey — only IMAGE
   * and file-backed STICKER rows need one; everything else (video,
   * audio, documents, contacts) always renders as a placeholder tile
   * since a static export can't play them anyway. */
  images: Map<string, HTMLImageElement>;
}

export type RowKind = "divider" | "msg" | "system";

export interface LayoutRow {
  kind: RowKind;
  y: number;
  height: number;
  index: number; // model index for msg/system rows
  label?: string; // divider text
  firstInGroup?: boolean;
  lines?: string[]; // pre-wrapped body text for TEXT rows
  bubbleW?: number;
  bubbleX?: number;
  imgW?: number;
  imgH?: number;
}

export interface Layout {
  rows: LayoutRow[];
  totalHeight: number;
  contentWidth: number;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    if (para === "") {
      lines.push("");
      continue;
    }
    const words = para.split(" ");
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (current && ctx.measureText(test).width > maxWidth) {
        lines.push(current);
        current = word;
        while (ctx.measureText(current).width > maxWidth && current.length > 1) {
          let lo = 1;
          let hi = current.length;
          while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (ctx.measureText(current.slice(0, mid)).width <= maxWidth) lo = mid;
            else hi = mid - 1;
          }
          lines.push(current.slice(0, lo));
          current = current.slice(lo);
        }
      } else {
        current = test;
      }
    }
    lines.push(current);
  }
  return lines;
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const sideMargin = (contentWidth: number) => Math.round(contentWidth * 0.06);

export function measureLayout(
  model: ChatModel,
  start: number,
  end: number,
  meId: number,
  opts: LayoutOptions,
): Layout {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const contentWidth = opts.contentWidth;
  const margin = sideMargin(contentWidth);
  const usableWidth = contentWidth - margin * 2;
  const bubbleMaxWidth = Math.min(usableWidth * 0.72, 420);
  const textMaxWidth = bubbleMaxWidth - BUBBLE_PAD_X * 2;

  const rows: LayoutRow[] = [];
  let y = 14;
  let lastDay: number | null = null;
  let lastSenderId = -1;

  for (let i = start; i < end; i++) {
    const type = model.type[i] as MsgType;
    const ts = model.ts[i];

    // Skipped before the divider check, which system rows never trigger
    // anyway — so dropping them can't leave a day without its heading.
    if (type === MsgType.SYSTEM && opts.showSystem === false) continue;

    if (type !== MsgType.SYSTEM) {
      const day = startOfDay(ts);
      if (day !== lastDay) {
        ctx.font = FONT_DIVIDER;
        const h = 30;
        rows.push({ kind: "divider", y, height: h, index: i, label: formatDateDivider(ts) });
        y += h;
        lastDay = day;
        lastSenderId = -1;
      }
    }

    if (type === MsgType.SYSTEM) {
      ctx.font = FONT_META;
      const maxW = usableWidth * 0.7;
      const lines = wrapText(ctx, model.bodies[i], maxW - 20);
      const h = lines.length * 16 + 14;
      rows.push({ kind: "system", y, height: h, index: i, lines });
      y += h + 6;
      continue;
    }

    const senderId = model.senderId[i];
    const firstInGroup = senderId !== lastSenderId || type === MsgType.CALL;
    lastSenderId = senderId;
    const body = model.bodies[i];
    const isMedia = MEDIA_TYPES.has(type);

    let contentH = 0;
    let lines: string[] | undefined;
    let bubbleW = bubbleMaxWidth;
    let imgW: number | undefined;
    let imgH: number | undefined;

    if (type === MsgType.DELETED || type === MsgType.CALL) {
      ctx.font = FONT_BODY;
      contentH = LINE_HEIGHT;
      bubbleW = Math.min(bubbleMaxWidth, ctx.measureText(body).width + 60);
    } else if (isMedia) {
      const img = model.mediaKey[i] ? opts.images.get(model.mediaKey[i]!) : undefined;
      if (type === MsgType.STICKER) {
        contentH = 128;
        bubbleW = 128;
      } else if (type === MsgType.IMAGE && img) {
        const maxW = bubbleMaxWidth - 8;
        const maxH = 320;
        const ratio = img.naturalWidth / img.naturalHeight || 1;
        let w = maxW;
        let h = w / ratio;
        if (h > maxH) {
          h = maxH;
          w = h * ratio;
        }
        imgW = w;
        imgH = h;
        contentH = h + 8;
        bubbleW = w + 8;
      } else {
        contentH = PLACEHOLDER_TILE_H;
        bubbleW = Math.min(bubbleMaxWidth, 260);
      }
      if (body) {
        ctx.font = FONT_BODY;
        lines = wrapText(ctx, body, (imgW ?? bubbleW) - BUBBLE_PAD_X * 2);
        contentH += lines.length * LINE_HEIGHT + 6;
      }
    } else {
      // TEXT
      ctx.font = FONT_BODY;
      lines = wrapText(ctx, body || " ", textMaxWidth);
      // Bubble width hugs the longest line, up to bubbleMaxWidth.
      let widest = 0;
      for (const l of lines) widest = Math.max(widest, ctx.measureText(l).width);
      bubbleW = Math.min(bubbleMaxWidth, Math.max(widest + BUBBLE_PAD_X * 2, 90));
      contentH = lines.length * LINE_HEIGHT;
    }

    const senderLabelH = opts.showSenderName && senderId !== meId && firstInGroup ? 17 : 0;
    const bubbleH =
      BUBBLE_PAD_TOP + senderLabelH + contentH + META_ROW_H + BUBBLE_PAD_BOTTOM;
    const gap = firstInGroup ? 6 : 1;
    const outgoing = senderId === meId;
    const bubbleX = outgoing ? contentWidth - margin - bubbleW : margin;

    rows.push({
      kind: "msg",
      y: y + gap,
      height: bubbleH + gap,
      index: i,
      firstInGroup,
      lines,
      bubbleW,
      bubbleX,
      imgW,
      imgH,
    });
    y += bubbleH + gap;
  }

  return { rows, totalHeight: y + 14, contentWidth };
}

function roundRectTail(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  tail: "left" | "right" | null,
) {
  ctx.beginPath();
  const tl = tail === "left" ? 0 : r;
  const tr = tail === "right" ? 0 : r;
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  if (tr) ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  if (tl) {
    ctx.lineTo(x, y + tl);
    ctx.arcTo(x, y, x + tl, y, tl);
  } else {
    ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawPlaceholderTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  icon: string,
  label: string,
) {
  ctx.fillStyle = "rgba(134,150,160,0.14)";
  ctx.beginPath();
  ctx.arc(x + 24, y + h / 2, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "18px sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(icon, x + 24, y + h / 2 + 1);
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = FONT_META;
  ctx.textAlign = "left";
  ctx.fillText(truncateToWidth(ctx, label, w - 56), x + 48, y + h / 2 + 1);
  ctx.textBaseline = "alphabetic";
}

/** Truncates text to fit `maxWidth`, appending an ellipsis, matching the
 * live UI's `text-overflow: ellipsis` on placeholder-tile labels. */
function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(text.slice(0, mid) + "…").width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + "…";
}

const PLACEHOLDER_ICON: Partial<Record<MsgType, [string, string]>> = {
  [MsgType.IMAGE]: ["📷", "Photo not included in this export"],
  [MsgType.VIDEO]: ["🎥", "Video"],
  [MsgType.STICKER]: ["🎭", "Sticker not included in this export"],
  [MsgType.AUDIO]: ["🎙", "Voice message"],
  [MsgType.DOCUMENT]: ["📄", "Document"],
  [MsgType.GIF]: ["▶", "GIF"],
  [MsgType.CONTACT]: ["👤", "Contact card"],
};

/** Paints every row overlapping [y0, y0+viewportH) into `ctx`, treating
 * (0,0) of the context as (0, y0) of the layout's coordinate space. */
export function paintRange(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  model: ChatModel,
  meId: number,
  opts: LayoutOptions,
  y0: number,
  viewportH: number,
) {
  ctx.save();
  ctx.fillStyle = COLORS.chatBg;
  ctx.fillRect(0, 0, layout.contentWidth, viewportH);
  ctx.translate(0, -y0);

  for (const row of layout.rows) {
    if (row.y + row.height < y0 || row.y > y0 + viewportH) continue;

    if (row.kind === "divider") {
      ctx.font = FONT_DIVIDER;
      const label = row.label!;
      const w = ctx.measureText(label).width + 24;
      const cx = layout.contentWidth / 2;
      ctx.fillStyle = COLORS.panelBg;
      roundRectTail(ctx, cx - w / 2, row.y + 4, w, 22, 8, null);
      ctx.fill();
      ctx.fillStyle = COLORS.textSecondary;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, cx, row.y + 15);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      continue;
    }

    if (row.kind === "system") {
      const lines = row.lines!;
      ctx.font = FONT_META;
      let widest = 0;
      for (const l of lines) widest = Math.max(widest, ctx.measureText(l).width);
      const w = widest + 24;
      const cx = layout.contentWidth / 2;
      ctx.fillStyle = COLORS.bubbleSystem;
      roundRectTail(ctx, cx - w / 2, row.y, w, row.height, 8, null);
      ctx.fill();
      ctx.fillStyle = COLORS.textPrimary;
      ctx.textAlign = "center";
      lines.forEach((l, li) => ctx.fillText(l, cx, row.y + 16 + li * 16));
      ctx.textAlign = "left";
      continue;
    }

    // msg row
    const i = row.index;
    const type = model.type[i] as MsgType;
    const flags = model.flags[i];
    const senderId = model.senderId[i];
    const outgoing = senderId === meId;
    const bubbleColor = outgoing ? COLORS.bubbleOut : COLORS.bubbleIn;
    const bx = row.bubbleX!;
    const by = row.y;
    const bw = row.bubbleW!;
    const bh = row.height - (row.firstInGroup ? 6 : 1);

    if (type === MsgType.STICKER) {
      // Bare — no bubble shell.
      const img = model.mediaKey[i] ? opts.images.get(model.mediaKey[i]!) : undefined;
      const sx = outgoing ? layout.contentWidth - sideMargin(layout.contentWidth) - bw : sideMargin(layout.contentWidth);
      if (img && flags & Flag.HAS_FILE) {
        ctx.drawImage(img, sx, by, bw, bh);
      } else {
        drawPlaceholderTile(ctx, sx, by, bw, Math.min(bh, 56), "🎭", "Sticker");
      }
      if (opts.showTimestamps) {
        ctx.font = FONT_META;
        ctx.fillStyle = COLORS.textSecondary;
        ctx.fillText(formatTime(model.ts[i]), sx, by + bh + 12);
      }
      continue;
    }

    const tail = row.firstInGroup ? (outgoing ? "right" : "left") : null;
    ctx.fillStyle = bubbleColor;
    ctx.shadowColor = COLORS.shadow;
    ctx.shadowBlur = 1;
    roundRectTail(ctx, bx, by, bw, bh, BUBBLE_RADIUS, tail);
    ctx.fill();
    ctx.shadowBlur = 0;

    let cy = by + BUBBLE_PAD_TOP;
    const cx = bx + BUBBLE_PAD_X;

    if (opts.showSenderName && !outgoing && row.firstInGroup) {
      ctx.font = FONT_SENDER;
      ctx.fillStyle = colorForSender(model.senders[senderId] ?? "");
      ctx.fillText(model.senders[senderId] ?? "", cx, cy + 12);
      cy += 17;
    }

    if (type === MsgType.DELETED) {
      ctx.font = FONT_BODY;
      ctx.fillStyle = COLORS.textSecondary;
      ctx.fillText("🚫 This message was deleted", cx, cy + 14);
    } else if (type === MsgType.CALL) {
      const missed = (flags & Flag.MISSED) !== 0;
      const isVideo = /video/i.test(model.bodies[i]);
      ctx.font = "13px sans-serif";
      ctx.fillStyle = missed ? COLORS.danger : COLORS.accent;
      ctx.fillText(missed ? "✕" : isVideo ? "🎥" : "📞", cx, cy + 14);
      ctx.font = FONT_BODY;
      ctx.fillStyle = COLORS.textPrimary;
      ctx.fillText(model.bodies[i], cx + 22, cy + 14);
    } else if (MEDIA_TYPES.has(type)) {
      const img = model.mediaKey[i] ? opts.images.get(model.mediaKey[i]!) : undefined;
      if (type === MsgType.IMAGE && img && row.imgW && row.imgH) {
        roundRectClip(ctx, cx - BUBBLE_PAD_X + 4, cy, row.imgW, row.imgH, 6);
        ctx.drawImage(img, cx - BUBBLE_PAD_X + 4, cy, row.imgW, row.imgH);
        ctx.restore();
        cy += row.imgH + 6;
      } else {
        const [icon, label] = PLACEHOLDER_ICON[type] ?? ["📎", "Media"];
        drawPlaceholderTile(ctx, cx - BUBBLE_PAD_X + 4, cy, bw - 8, PLACEHOLDER_TILE_H, icon, label);
        cy += PLACEHOLDER_TILE_H;
      }
      if (row.lines) {
        ctx.font = FONT_BODY;
        ctx.fillStyle = COLORS.textPrimary;
        row.lines.forEach((l, li) => ctx.fillText(l, cx, cy + 14 + li * LINE_HEIGHT));
      }
    } else {
      // TEXT
      ctx.font = FONT_BODY;
      ctx.fillStyle = COLORS.textPrimary;
      const lines = row.lines ?? [""];
      lines.forEach((l, li) => ctx.fillText(l, cx, cy + 14 + li * LINE_HEIGHT));
    }

    // Meta row (edited / time / ticks) bottom-right of bubble.
    const metaY = by + bh - 6;
    let metaX = bx + bw - BUBBLE_PAD_X;
    ctx.font = FONT_META;
    ctx.textAlign = "right";
    ctx.fillStyle = COLORS.textSecondary;
    const time = opts.showTimestamps ? formatTime(model.ts[i]) : "";
    if (outgoing && type !== MsgType.SYSTEM) {
      ctx.fillStyle = COLORS.accent;
      ctx.fillText("✓✓", metaX, metaY);
      metaX -= ctx.measureText("✓✓ ").width;
      ctx.fillStyle = COLORS.textSecondary;
    }
    if (time) {
      ctx.fillText(time, metaX, metaY);
      metaX -= ctx.measureText(`${time} `).width;
    }
    if (flags & Flag.EDITED) {
      ctx.font = `italic ${FONT_META}`;
      ctx.fillText("edited", metaX, metaY);
    }
    ctx.textAlign = "left";
  }

  ctx.restore();
}

function roundRectClip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.save();
  roundRectTail(ctx, x, y, w, h, r, null);
  ctx.clip();
}

/** Draws the chat header bar (avatar + name + subtitle) used at the top
 * of a PNG export / the first PDF page. */
export function paintHeader(
  ctx: CanvasRenderingContext2D,
  width: number,
  name: string,
  subtitle: string,
  height = 56,
) {
  ctx.fillStyle = COLORS.headerBg;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = COLORS.accent;
  ctx.beginPath();
  ctx.arc(30, height / 2, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "600 14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  ctx.fillText(initials, 30, height / 2 + 1);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = COLORS.textPrimary;
  ctx.font = FONT_HEADER_NAME;
  ctx.fillText(name, 58, height / 2 - 2);
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = FONT_HEADER_SUB;
  ctx.fillText(subtitle, 58, height / 2 + 14);
}
