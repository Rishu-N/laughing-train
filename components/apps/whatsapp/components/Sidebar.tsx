import { useMemo, useRef, useState, type DragEvent } from "react";
import { ConfirmDialog } from "@/components/os/ui";
import { conversations } from "@/content/conversations";
import { useApp } from "../state/AppContext";
import { formatDateShort, initials } from "../lib/format";
import { sampleChatId } from "../lib/samples";
import type { ChatRecord } from "../lib/store/db";

function ChatRow({
  chat,
  active,
  onOpen,
  onDelete,
  onRename,
  onMergeMore,
}: {
  chat: ChatRecord;
  active: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
  onMergeMore: (files: File[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(chat.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const mergeInputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== chat.name) onRename(trimmed);
    setEditing(false);
  };

  const sourceCount = chat.rawTexts.length;

  return (
    <>
      <div className={`chat-row${active ? " active" : ""}`} onClick={() => !editing && onOpen()}>
        <div className="chat-avatar">{initials(chat.name)}</div>
        <div className="chat-row-main">
          {editing ? (
            <input
              className="chat-rename-input"
              autoFocus
              value={draft}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") {
                  setDraft(chat.name);
                  setEditing(false);
                }
              }}
            />
          ) : (
            <div className="chat-row-name">{chat.name}</div>
          )}
          <div className="chat-row-preview">{chat.lastPreview || "No messages"}</div>
          <div className="chat-row-meta">
            {chat.messageCount.toLocaleString()} messages · {formatDateShort(chat.firstTs)} –{" "}
            {formatDateShort(chat.lastTs)}
            {sourceCount > 1 && (
              <span className="chat-row-stitched"> · stitched from {sourceCount} exports</span>
            )}
          </div>
        </div>
        <div className="chat-row-actions">
          <input
            ref={mergeInputRef}
            type="file"
            accept=".zip"
            multiple
            hidden
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length > 0) onMergeMore(files);
              e.target.value = "";
            }}
          />
          <button
            className="icon-btn small"
            title="Merge another export into this chat"
            aria-label={`Merge another export into ${chat.name}`}
            onClick={(e) => {
              e.stopPropagation();
              mergeInputRef.current?.click();
            }}
          >
            ⇄
          </button>
          <button
            className="icon-btn small"
            title="Rename"
            aria-label={`Rename ${chat.name}`}
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
          >
            ✎
          </button>
          <button
            className="icon-btn small"
            title="Delete"
            aria-label={`Delete ${chat.name}`}
            onClick={(e) => {
              e.stopPropagation();
              setConfirmingDelete(true);
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* window.confirm() would sit outside the OS entirely; the shared
          System 7 alert dims only this window. */}
      {confirmingDelete && (
        <ConfirmDialog
          title="Remove chat"
          message={`Remove “${chat.name}” from history? This deletes it and its media.`}
          confirmLabel="Remove"
          onConfirm={() => {
            setConfirmingDelete(false);
            onDelete();
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </>
  );
}

/**
 * The sample exports that ship in the Downloads folder, listed here too so
 * they are discoverable without leaving the app. Rows disappear from this
 * section once imported — they show up in the history list above instead.
 */
function SampleRows({ importedIds }: { importedIds: Set<string> }) {
  const app = useApp();
  const remaining = conversations.filter((c) => !importedIds.has(sampleChatId(c.id)));
  if (remaining.length === 0) return null;

  return (
    <>
      <div className="sidebar-section-title">Sample exports</div>
      {remaining.map((c) => (
        <div key={c.id} className="chat-row" onClick={() => void app.loadSample(c)}>
          <div className="chat-avatar sample">{initials(c.title)}</div>
          <div className="chat-row-main">
            <div className="chat-row-name">{c.title}</div>
            <div className="chat-row-preview">{c.blurb}</div>
            <div className="chat-row-meta">
              {c.messages.length} messages · {c.participants.length} participants
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const app = useApp();
  const [filter, setFilter] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return app.chats;
    return app.chats.filter(
      (c) => c.name.toLowerCase().includes(q) || c.lastPreview.toLowerCase().includes(q),
    );
  }, [app.chats, filter]);

  const importedIds = useMemo(() => new Set(app.chats.map((c) => c.id)), [app.chats]);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const zips = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".zip"));
    // Two or more zips dropped together are treated as multiple exports
    // of the same conversation and stitched into one chat.
    if (zips.length > 0) void app.importZipFiles(zips);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <aside className="sidebar" aria-label="Chat history">
      <header className="sidebar-header">
        <h1>Chats</h1>
        {onClose && (
          <button className="icon-btn small" title="Close" aria-label="Close chat list" onClick={onClose}>
            ✕
          </button>
        )}
      </header>

      <div
        className={`dropzone${dragOver ? " drag-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          multiple
          hidden
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="dropzone-icon" aria-hidden>
          ＋
        </div>
        <div>
          <strong>Import a chat export</strong>
          <div className="dropzone-hint">
            Drop one or more WhatsApp .zip files here, or click to browse. Multiple exports of the
            same chat are stitched together automatically.
          </div>
        </div>
      </div>

      {app.importProgress && (
        <div className="import-progress">
          {app.importProgress.phase === "unzip" ? "Unzipping…" : "Parsing messages…"}
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${Math.min(100, (app.importProgress.done / Math.max(1, app.importProgress.total)) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {app.mergeStats && app.mergeStats.sourceCount > 1 && (
        <div className={`merge-stats${app.mergeStats.warning ? " warn" : ""}`}>
          <div>
            Stitched {app.mergeStats.sourceCount} exports →{" "}
            {app.mergeStats.uniqueOutput.toLocaleString()} unique messages
            {app.mergeStats.duplicatesRemoved > 0 &&
              ` (${app.mergeStats.duplicatesRemoved.toLocaleString()} duplicate${app.mergeStats.duplicatesRemoved === 1 ? "" : "s"} removed)`}
            .
            {app.mergeStats.warning && (
              <div className="merge-stats-warning">{app.mergeStats.warning}</div>
            )}
          </div>
          <button className="icon-btn small" aria-label="Dismiss" onClick={app.dismissMergeStats}>
            ✕
          </button>
        </div>
      )}

      {app.importError && (
        <div className="import-error" role="alert">
          {app.importError}
          <button className="icon-btn small" aria-label="Dismiss" onClick={app.dismissImportError}>
            ✕
          </button>
        </div>
      )}

      <div className="sidebar-search">
        <input
          type="search"
          placeholder="Search chat history"
          aria-label="Search chat history"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="sidebar-scroll">
        {filtered.length === 0 && (
          <div className="chat-list-empty">
            {app.chats.length === 0 ? "No chats imported yet." : "No chats match your search."}
          </div>
        )}
        {filtered.map((c) => (
          <ChatRow
            key={c.id}
            chat={c}
            active={c.id === app.activeChatId}
            onOpen={() => void app.openChat(c.id)}
            onDelete={() => void app.deleteChatById(c.id)}
            onRename={(name) => void app.renameChatById(c.id, name)}
            onMergeMore={(files) => void app.mergeMoreIntoChat(c.id, files)}
          />
        ))}
        {filter.trim() === "" && <SampleRows importedIds={importedIds} />}
      </div>
    </aside>
  );
}
