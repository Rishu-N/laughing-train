import { useState } from "react";
import { useApp } from "../state/AppContext";
import { fromDatetimeLocalValue, toDatetimeLocalValue } from "../lib/format";

const DAY = 24 * 60 * 60 * 1000;

export function SettingsPanel() {
  const app = useApp();
  const hasChat = app.model.count > 0;
  // Stands in for the chat's own bounds while nothing is loaded. Read once at
  // mount rather than on every render: Date.now() in a render body is impure,
  // and a clock that advances under the date inputs would make them drift while
  // the panel is simply open.
  const [mountedAt] = useState(() => Date.now());
  const lastTs = hasChat ? app.model.ts[app.model.count - 1] : mountedAt;
  const firstTs = hasChat ? app.model.ts[0] : mountedAt;

  const applyPreset = (preset: "7d" | "30d" | "year" | "all") => {
    if (preset === "all") {
      app.clearRange();
      return;
    }
    if (preset === "7d") {
      app.setRange({ startMs: lastTs - 7 * DAY, endMs: lastTs });
      return;
    }
    if (preset === "30d") {
      app.setRange({ startMs: lastTs - 30 * DAY, endMs: lastTs });
      return;
    }
    if (preset === "year") {
      const jan1 = new Date(new Date(lastTs).getFullYear(), 0, 1).getTime();
      app.setRange({ startMs: jan1, endMs: lastTs });
    }
  };

  return (
    <>
      {app.settingsPanelOpen && (
        <div className="settings-backdrop" onClick={app.toggleSettingsPanel} />
      )}
      <div className={`settings-drawer${app.settingsPanelOpen ? " open" : ""}`}>
        <header className="settings-header">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={app.toggleSettingsPanel} title="Close">
            ✕
          </button>
        </header>

        <div className="settings-body">
          <section className="settings-section">
            <h3>Date &amp; time range</h3>
            {!hasChat && <p className="settings-hint">Open a chat to filter its messages.</p>}
            <div className="range-fields">
              <label>
                From
                <input
                  type="datetime-local"
                  disabled={!hasChat}
                  value={app.range.startMs !== null ? toDatetimeLocalValue(app.range.startMs) : ""}
                  min={hasChat ? toDatetimeLocalValue(firstTs) : undefined}
                  max={hasChat ? toDatetimeLocalValue(lastTs) : undefined}
                  onChange={(e) =>
                    app.setRange({ ...app.range, startMs: fromDatetimeLocalValue(e.target.value) })
                  }
                />
              </label>
              <label>
                To
                <input
                  type="datetime-local"
                  disabled={!hasChat}
                  value={app.range.endMs !== null ? toDatetimeLocalValue(app.range.endMs) : ""}
                  min={hasChat ? toDatetimeLocalValue(firstTs) : undefined}
                  max={hasChat ? toDatetimeLocalValue(lastTs) : undefined}
                  onChange={(e) =>
                    app.setRange({ ...app.range, endMs: fromDatetimeLocalValue(e.target.value) })
                  }
                />
              </label>
            </div>
            <div className="preset-row">
              <button className="chip" disabled={!hasChat} onClick={() => applyPreset("7d")}>
                Last 7 days
              </button>
              <button className="chip" disabled={!hasChat} onClick={() => applyPreset("30d")}>
                Last 30 days
              </button>
              <button className="chip" disabled={!hasChat} onClick={() => applyPreset("year")}>
                This year
              </button>
              <button className="chip" disabled={!hasChat} onClick={() => applyPreset("all")}>
                All time
              </button>
            </div>
            {hasChat && (app.range.startMs !== null || app.range.endMs !== null) && (
              <p className="settings-hint">
                Showing {app.visibleRange.end - app.visibleRange.start} of {app.model.count}{" "}
                messages.{" "}
                <button className="link-btn" onClick={app.clearRange}>
                  Clear filter
                </button>
              </p>
            )}
          </section>

          <section className="settings-section">
            <h3>I am…</h3>
            {!hasChat && <p className="settings-hint">Open a chat to choose who you are.</p>}
            {hasChat && (
              <>
                <div className="radio-list">
                  {app.model.senders.map((s, i) => (
                    <label key={s} className="radio-row">
                      <input
                        type="radio"
                        name="me-id"
                        checked={app.meId === i}
                        onChange={() => app.setMeId(i)}
                      />
                      {s}
                    </label>
                  ))}
                </div>
                <p className="settings-hint">Your selection appears on the right, in green.</p>
              </>
            )}
          </section>

          <section className="settings-section">
            <h3>Date format</h3>
            {!hasChat && <p className="settings-hint">Open a chat to adjust date parsing.</p>}
            {hasChat && (
              <>
                <div className="radio-list horizontal">
                  <label className="radio-row">
                    <input
                      type="radio"
                      name="date-order"
                      checked={app.model.dateOrder === "DMY"}
                      onChange={() => void app.setDateOrderOverride("DMY")}
                    />
                    Day/Month/Year
                  </label>
                  <label className="radio-row">
                    <input
                      type="radio"
                      name="date-order"
                      checked={app.model.dateOrder === "MDY"}
                      onChange={() => void app.setDateOrderOverride("MDY")}
                    />
                    Month/Day/Year
                  </label>
                </div>
                <p className="settings-hint">
                  {app.model.dateOrderCertain
                    ? "Detected automatically from the export."
                    : "Couldn't detect this with certainty (every day was ≤ 12) — flip it if dates look wrong."}
                </p>
              </>
            )}
          </section>

          <section className="settings-section">
            <h3>Appearance</h3>
            <div className="radio-list horizontal">
              <label className="radio-row">
                <input
                  type="radio"
                  name="theme"
                  checked={app.settings.theme === "light"}
                  onChange={() => app.setSettings({ theme: "light" })}
                />
                Light
              </label>
              <label className="radio-row">
                <input
                  type="radio"
                  name="theme"
                  checked={app.settings.theme === "dark"}
                  onChange={() => app.setSettings({ theme: "dark" })}
                />
                Dark
              </label>
            </div>
          </section>

          <section className="settings-section">
            <h3>Message display</h3>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={app.settings.showTimestamps}
                onChange={(e) => app.setSettings({ showTimestamps: e.target.checked })}
              />
              Show timestamps
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={app.settings.showSystem}
                onChange={(e) => app.setSettings({ showSystem: e.target.checked })}
              />
              Show system messages (encryption notices, etc.)
            </label>
          </section>
        </div>
      </div>
    </>
  );
}
