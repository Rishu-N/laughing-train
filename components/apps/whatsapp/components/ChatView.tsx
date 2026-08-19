import { useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useApp } from "../state/AppContext";
import { MsgType } from "../lib/model";
import { formatDateDivider, formatDateShort, initials } from "../lib/format";
import { Bubble, SystemBubble } from "./Bubble";
import { DateDivider } from "./DateDivider";
import { SearchBar } from "./SearchBar";
import { ChatBubblesIcon } from "./Icons";

type Row =
  | { kind: "divider"; label: string; key: string }
  | { kind: "msg"; index: number; key: string; firstInGroup: boolean };

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function EmptyState() {
  return (
    <div className="chat-empty" data-testid="whatsapp-empty">
      <div className="chat-empty-art">
        <ChatBubblesIcon size={64} />
      </div>
      <h2>No chat open</h2>
      <p>Pick a sample export or import your own WhatsApp .zip to preview, filter and share it.</p>
    </div>
  );
}

export function ChatView({ searchOpen }: { searchOpen: boolean }) {
  const app = useApp();
  const parentRef = useRef<HTMLDivElement>(null);
  const isGroup = app.model.senders.length > 2;
  const hasChat = !!app.activeChatId;

  const { rows, stickyLabelForRow } = useMemo(() => {
    const rows: Row[] = [];
    const stickyLabelForRow: string[] = [];
    let lastDay: number | null = null;
    let currentLabel = "";
    let lastSenderId = -1; // consecutive same-sender messages group together, WhatsApp-style
    const { model, visibleRange, settings } = app;
    for (let i = visibleRange.start; i < visibleRange.end; i++) {
      if (model.type[i] === MsgType.SYSTEM && !settings.showSystem) continue;
      const ts = model.ts[i];
      const day = startOfDay(ts);
      if (day !== lastDay) {
        currentLabel = formatDateDivider(ts);
        rows.push({ kind: "divider", label: currentLabel, key: `d${day}` });
        stickyLabelForRow.push(currentLabel);
        lastDay = day;
        lastSenderId = -1; // a new day always starts a fresh group
      }
      const senderId = model.senderId[i];
      const firstInGroup = senderId !== lastSenderId || model.type[i] === MsgType.CALL;
      rows.push({ kind: "msg", index: i, key: `m${i}`, firstInGroup });
      stickyLabelForRow.push(currentLabel);
      lastSenderId = senderId;
    }
    return { rows, stickyLabelForRow };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.model, app.visibleRange, app.settings.showSystem]);

  // The compiler lint objects that useVirtualizer returns functions it cannot
  // prove safe to memoize. That is a known property of the library, not a bug
  // here — and virtualization is exactly what lets a 200k-message chat render
  // at all, so the alternative is not "do it differently", it is "do it badly".
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 12,
    // react-virtual defaults to flushSync on sync updates (e.g. the
    // ResizeObserver behind measureElement); under React 19 that trips
    // "flushSync called from inside a lifecycle method" because the
    // observer callback can fire during commit. Disabling it trades away
    // a same-frame guarantee we don't rely on for a plain rerender.
    useFlushSync: false,
  });

  // Jump to the newest message whenever a different chat is opened.
  useEffect(() => {
    if (rows.length > 0) {
      requestAnimationFrame(() => virtualizer.scrollToIndex(rows.length - 1, { align: "end" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.activeChatId]);

  // Scroll to the active search hit.
  useEffect(() => {
    if (app.search.activeHit < 0) return;
    const modelIdx = app.search.hits[app.search.activeHit];
    const rowIdx = rows.findIndex((r) => r.kind === "msg" && r.index === modelIdx);
    if (rowIdx >= 0) virtualizer.scrollToIndex(rowIdx, { align: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.search.activeHit]);

  if (!hasChat) return <EmptyState />;

  const virtualItems = virtualizer.getVirtualItems();
  const stickyLabel = virtualItems.length > 0 ? stickyLabelForRow[virtualItems[0].index] : "";
  const activeHitModelIndex =
    app.search.activeHit >= 0 ? app.search.hits[app.search.activeHit] : -1;

  const contactName = app.activeRecord?.name ?? "Chat";
  const filtered = app.range.startMs !== null || app.range.endMs !== null;

  return (
    <div className="chat-panel" data-testid="whatsapp-chat">
      {/* Search and export used to live here as WhatsApp-style icon buttons.
          Inside the OS they are window chrome, so they moved up to the shared
          System 7 toolbar and this header went back to being purely
          informational — which is all WhatsApp's own header really is. */}
      <header className="chat-header">
        <div className="chat-avatar">{initials(contactName)}</div>
        <div className="chat-header-info">
          <div className="chat-header-name">{contactName}</div>
          <div className="chat-header-sub" data-testid="whatsapp-chat-meta">
            {(app.visibleRange.end - app.visibleRange.start).toLocaleString()} messages
            {filtered && " · filtered"}
            {app.visibleRange.end > app.visibleRange.start &&
              ` · ${formatDateShort(app.model.ts[app.visibleRange.start])} – ${formatDateShort(app.model.ts[app.visibleRange.end - 1])}`}
          </div>
        </div>
      </header>

      {searchOpen && <SearchBar />}

      <div ref={parentRef} className="chat-scroll">
        <div className="chat-scroll-inner">
          {stickyLabel && (
            <div className="sticky-date-wrap">
              <DateDivider label={stickyLabel} />
            </div>
          )}
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualItems.map((vi) => {
              const row = rows[vi.index];
              return (
                <div
                  key={row.key}
                  ref={virtualizer.measureElement}
                  data-index={vi.index}
                  className="virtual-row"
                  style={{ transform: `translateY(${vi.start}px)` }}
                >
                  {row.kind === "divider" ? (
                    <DateDivider label={row.label} />
                  ) : app.model.type[row.index] === MsgType.SYSTEM ? (
                    <SystemBubble text={app.model.bodies[row.index]} />
                  ) : (
                    <div
                      className={
                        (row.firstInGroup ? "grouped-first" : "grouped-rest") +
                        (row.index === activeHitModelIndex ? " hit-highlight" : "")
                      }
                    >
                      <Bubble
                        model={app.model}
                        index={row.index}
                        meId={app.meId}
                        mediaBlobs={app.mediaBlobs}
                        showTimestamps={app.settings.showTimestamps}
                        showSenderName={isGroup && row.firstInGroup}
                        tail={row.firstInGroup}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
