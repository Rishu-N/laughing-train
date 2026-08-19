'use client';

/**
 * The session history, after the Mac app's HistoryView.
 *
 * Each row carries the transcript plus how it was produced, because that context
 * is the point: a demo line and a real transcription look identical as text and
 * must never look identical here. The Mac app keeps the uploaded audio alongside
 * each row so you can play it back; this one deliberately does not — raw audio
 * is dropped the moment it has been sent.
 */
import { Button, ToolbarSpacer } from '@/components/os/ui';
import { useDictationStore } from '@/lib/os/dictation';
import { SourceBadge } from './SourceBadge';

function clockTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function HistoryPane({ onInsert }: { onInsert: (text: string) => void }) {
  const history = useDictationStore((s) => s.history);
  const clearHistory = useDictationStore((s) => s.clearHistory);

  // Newest first: the thing you just said is the thing you want to act on.
  const rows = [...history].reverse();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-os-chrome-dark bg-os-chrome px-2 py-1">
        <span className="os-chrome-text text-[10px]">Recent</span>
        <span className="os-chrome-text text-[10px] text-os-ink-soft">{history.length}</span>
        <ToolbarSpacer />
        <Button disabled={history.length === 0} onClick={clearHistory}>
          Clear All
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="p-4 text-[12px] leading-snug text-os-ink-soft">
          No transcriptions yet. Press Record and everything you dictate this session shows up
          here.
        </p>
      ) : (
        <ul className="os-scroll min-h-0 flex-1 overflow-auto">
          {rows.map((entry) => (
            <li key={entry.id} className="border-b border-os-chrome-dim px-2 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <SourceBadge source={entry.source} />
                <span className="os-chrome-text text-[10px] text-os-ink-soft">
                  {clockTime(entry.at)}
                </span>
                <ToolbarSpacer />
                <Button onClick={() => onInsert(entry.text)}>Insert</Button>
              </div>
              <p className="mt-1.5 text-[12px] leading-snug text-os-ink">{entry.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
