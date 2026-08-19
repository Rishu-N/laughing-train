import { useEffect, useRef, useState } from "react";
import { useApp } from "../state/AppContext";

const DEBOUNCE_MS = 150;

export function SearchBar() {
  const app = useApp();
  const [text, setText] = useState(app.search.query);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => app.runSearch(text), DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const count = app.search.hits.length;

  return (
    <div className="search-bar">
      <input
        ref={inputRef}
        type="search"
        placeholder="Search in this chat"
        aria-label="Search in this chat"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (e.shiftKey) app.prevHit();
            else app.nextHit();
          }
          if (e.key === "Escape") {
            setText("");
            app.clearSearch();
          }
        }}
      />
      <span className="search-count">
        {text.trim() === "" ? "" : count === 0 ? "No results" : `${app.search.activeHit + 1} / ${count}`}
      </span>
      <button className="icon-btn small" onClick={app.prevHit} disabled={count === 0} title="Previous match">
        ↑
      </button>
      <button className="icon-btn small" onClick={app.nextHit} disabled={count === 0} title="Next match">
        ↓
      </button>
      <button
        className="icon-btn small"
        onClick={() => {
          setText("");
          app.clearSearch();
        }}
        title="Clear"
      >
        ✕
      </button>
    </div>
  );
}
