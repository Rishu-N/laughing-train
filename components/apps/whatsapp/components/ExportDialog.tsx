/*
 * Export chooser.
 *
 * The standalone build drew its own rounded WhatsApp-green sheet. In the OS an
 * export dialog is window chrome rather than chat, so it renders through the
 * shared System 7 <Dialog> and uses the shared Radio/Button primitives — the
 * WhatsApp look stops at the edge of the conversation. Nothing about the three
 * exporters themselves changed.
 */
import { useMemo, useRef, useState } from "react";
import { Button, Dialog, Radio } from "@/components/os/ui";
import { useApp } from "../state/AppContext";
import { exportPdf, estimatePdfPageCount } from "../lib/export/pdf";
import { exportPng } from "../lib/export/png";
import { exportHtml, estimateHtmlSize } from "../lib/export/html";
import { ExportCancelled, type CancelToken } from "../lib/export/shared";

type Format = "pdf" | "png" | "html";

const FORMATS: { id: Format; label: string; detail: string }[] = [
  { id: "pdf", label: "PDF", detail: "Paginated bubbles, for print or sharing" },
  { id: "png", label: "Image (PNG)", detail: "One long screenshot of the conversation" },
  { id: "html", label: "Web page (HTML)", detail: "Self-contained file, opens in any browser" },
];

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Closing the sheet UNMOUNTS it, and that is what resets it.
 *
 * The obvious alternative — keep it mounted, return null while closed, and
 * clear five pieces of state from an effect — leaves the dialog's state machine
 * and what is on screen able to disagree, and fires a cascading render on every
 * close. Letting React throw the state away is both simpler and correct.
 */
export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <ExportSheet onClose={onClose} />;
}

function ExportSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const [format, setFormat] = useState<Format>("pdf");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<CancelToken>({ cancelled: false });

  const { start, end } = app.visibleRange;
  const count = end - start;
  const contactName = app.activeRecord?.name ?? "Chat";
  const isGroup = app.model.senders.length > 2;

  const htmlBytes = useMemo(
    () => (format === "html" ? estimateHtmlSize(app.model, start, end, app.mediaBlobs) : 0),
    [format, app.model, start, end, app.mediaBlobs],
  );

  const estimate = useMemo(() => {
    if (count === 0) return null;
    if (format === "pdf") {
      const pages = estimatePdfPageCount(app.model, start, end, app.meId, isGroup, app.settings.showSystem);
      return `${pages.toLocaleString()} page${pages === 1 ? "" : "s"}`;
    }
    if (format === "html") return `~${formatBytes(htmlBytes)}`;
    return null;
  }, [format, app.model, start, end, app.meId, isGroup, count, htmlBytes, app.settings.showSystem]);

  const sizeWarning = format === "html" && htmlBytes > 50 * 1024 * 1024;

  const runExport = async () => {
    setBusy(true);
    setError(null);
    cancelRef.current = { cancelled: false };
    const common = {
      model: app.model,
      start,
      end,
      meId: app.meId,
      contactName,
      mediaBlobs: app.mediaBlobs,
      showTimestamps: app.settings.showTimestamps,
      showSenderName: isGroup,
      // The export is the document you were just looking at, so it obeys the
      // same Settings switch the live chat does.
      showSystem: app.settings.showSystem,
      cancelToken: cancelRef.current,
      onProgress: (d: number, t: number) => setProgress({ done: d, total: t }),
    };
    try {
      if (format === "pdf") await exportPdf(common);
      else if (format === "png") await exportPng(common);
      else await exportHtml(common);
      setDone(true);
      setTimeout(onClose, 1100);
    } catch (err) {
      if (err instanceof ExportCancelled) {
        setBusy(false);
        setProgress(null);
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  if (error) {
    return (
      <Dialog
        title="Export failed"
        onDismiss={onClose}
        actions={
          <Button isDefault onClick={onClose}>
            OK
          </Button>
        }
      >
        {error}
      </Dialog>
    );
  }

  if (done) {
    return <Dialog title="Export chat">Downloaded.</Dialog>;
  }

  if (busy) {
    return (
      <Dialog
        title="Export chat"
        actions={
          <Button onClick={() => (cancelRef.current.cancelled = true)}>Cancel</Button>
        }
      >
        <p className="mb-2">
          {format === "pdf" && "Rendering pages…"}
          {format === "png" && "Rendering image…"}
          {format === "html" && "Embedding media…"}
        </p>
        {progress && (
          <div className="os-inset h-[10px] w-full overflow-hidden rounded-[2px]">
            <div
              className="h-full bg-os-accent transition-[width] duration-150"
              style={{
                width: `${Math.min(100, (progress.done / Math.max(1, progress.total)) * 100)}%`,
              }}
            />
          </div>
        )}
        {progress && (
          <p className="mt-1 text-[11px] text-os-ink-soft">
            {progress.done} / {progress.total}
          </p>
        )}
      </Dialog>
    );
  }

  return (
    <Dialog
      title="Export chat"
      width={380}
      onDismiss={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button isDefault disabled={count === 0} onClick={runExport}>
            Export
          </Button>
        </>
      }
    >
      <p className="mb-2 text-os-ink-soft">
        {count.toLocaleString()} message{count === 1 ? "" : "s"}
        {app.range.startMs !== null || app.range.endMs !== null ? " (filtered range)" : ""}
      </p>

      <div className="flex flex-col gap-1.5">
        {FORMATS.map((f) => (
          <Radio
            key={f.id}
            name="wa-export-format"
            checked={format === f.id}
            onChange={() => setFormat(f.id)}
            label={
              <span>
                {f.label}
                <span className="text-os-ink-soft"> — {f.detail}</span>
              </span>
            }
          />
        ))}
      </div>

      {estimate && <p className="mt-3 text-[11px] text-os-ink-soft">Estimated size: {estimate}</p>}
      {sizeWarning && (
        <p className="mt-2 text-[11px] text-os-warn">
          This will embed a lot of media. Consider narrowing the date range first.
        </p>
      )}
      {count === 0 && <p className="mt-2 text-[11px] text-os-warn">No messages in the current filter.</p>}
    </Dialog>
  );
}
