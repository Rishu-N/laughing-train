// PDF export — paginates the painted chat at A4, one offscreen canvas
// per page (released as soon as that page is embedded), so a
// thousand-page export doesn't hold more than one page's pixels in
// memory at a time.
// pdf-lib is dynamically imported inside exportPdf() rather than here —
// it's a sizeable library that most sessions (browsing, importing,
// exporting PNG/HTML) never touch, so it shouldn't bloat the initial
// page load for everyone.
import { measureLayout, paintRange, type LayoutOptions } from "../layout/bubbles";
import type { ChatModel } from "../model";
import { preloadImages, revokeImages, downloadBlob, safeFileStem, checkCancelled, type CancelToken } from "./shared";

const PT = { A4W: 595.28, A4H: 841.89, MARGIN: 28, HEADER_H: 34 };
const SCALE = 2; // render at 2x point-size for crisp print output

export interface PdfExportParams {
  model: ChatModel;
  start: number;
  end: number;
  meId: number;
  contactName: string;
  mediaBlobs: Map<string, Blob>;
  showTimestamps: boolean;
  showSenderName: boolean;
  onProgress?: (page: number, total: number) => void;
  cancelToken?: CancelToken;
}

/** Runs layout only — used by the export dialog to show an estimated
 * page count before the user commits to a (potentially slow) export. */
export function estimatePdfPageCount(model: ChatModel, start: number, end: number, meId: number, showSenderName: boolean): number {
  const contentWidthPx = (PT.A4W - PT.MARGIN * 2) * SCALE;
  const layout = measureLayout(model, start, end, meId, {
    contentWidth: contentWidthPx,
    showTimestamps: true,
    showSenderName,
    images: new Map(),
  });
  const perPagePx = (PT.A4H - PT.MARGIN * 2 - PT.HEADER_H) * SCALE;
  return Math.max(1, Math.ceil(layout.totalHeight / perPagePx));
}

export async function exportPdf(params: PdfExportParams): Promise<void> {
  const { model, start, end, meId, contactName, mediaBlobs, showTimestamps, showSenderName, onProgress, cancelToken } = params;

  const [{ PDFDocument, StandardFonts, rgb }, images] = await Promise.all([
    import("pdf-lib"),
    preloadImages(model, start, end, mediaBlobs),
  ]);
  checkCancelled(cancelToken);

  const contentWidthPx = (PT.A4W - PT.MARGIN * 2) * SCALE;
  const opts: LayoutOptions = { contentWidth: contentWidthPx, showTimestamps, showSenderName, images };
  const layout = measureLayout(model, start, end, meId, opts);

  const perPagePx = (PT.A4H - PT.MARGIN * 2 - PT.HEADER_H) * SCALE;
  const pageCount = Math.max(1, Math.ceil(layout.totalHeight / perPagePx));

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`WhatsApp chat with ${contactName}`);
  pdfDoc.setProducer("WhatsApp Chat Simulator");
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const dateRange =
    end > start
      ? `${new Date(model.ts[start]).toLocaleDateString()} – ${new Date(model.ts[end - 1]).toLocaleDateString()}`
      : "";

  try {
    for (let p = 0; p < pageCount; p++) {
      checkCancelled(cancelToken);
      const y0 = p * perPagePx;
      const viewportH = Math.min(perPagePx, layout.totalHeight - y0);

      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(contentWidthPx);
      canvas.height = Math.ceil(viewportH);
      const ctx = canvas.getContext("2d")!;
      paintRange(ctx, layout, model, meId, opts, y0, viewportH);

      const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const jpegBytes = dataUrlToBytes(jpegDataUrl);
      const jpgImage = await pdfDoc.embedJpg(jpegBytes);

      const page = pdfDoc.addPage([PT.A4W, PT.A4H]);
      page.drawText(contactName, {
        x: PT.MARGIN,
        y: PT.A4H - PT.MARGIN - 14,
        size: 12,
        font: fontBold,
        color: rgb(0.07, 0.11, 0.13),
      });
      page.drawText(dateRange, {
        x: PT.MARGIN,
        y: PT.A4H - PT.MARGIN - 27,
        size: 8.5,
        font: fontRegular,
        color: rgb(0.4, 0.47, 0.5),
      });
      const pageLabel = `Page ${p + 1} of ${pageCount}`;
      const labelWidth = fontRegular.widthOfTextAtSize(pageLabel, 8.5);
      page.drawText(pageLabel, {
        x: PT.A4W - PT.MARGIN - labelWidth,
        y: PT.A4H - PT.MARGIN - 14,
        size: 8.5,
        font: fontRegular,
        color: rgb(0.4, 0.47, 0.5),
      });

      const imgHeightPt = viewportH / SCALE;
      page.drawImage(jpgImage, {
        x: PT.MARGIN,
        y: PT.A4H - PT.MARGIN - PT.HEADER_H - imgHeightPt,
        width: PT.A4W - PT.MARGIN * 2,
        height: imgHeightPt,
      });

      onProgress?.(p + 1, pageCount);
      // Yield to the event loop between pages so the tab stays
      // responsive (and a cancel click can actually be processed) on a
      // very long export.
      await new Promise((r) => setTimeout(r, 0));
    }

    const bytes = await pdfDoc.save();
    downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${safeFileStem(contactName)}.pdf`);
  } finally {
    revokeImages(images);
  }
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
