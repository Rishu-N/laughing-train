'use client';

/**
 * Downloads — the folder the sample chat exports live in.
 *
 * It is a folder in the same sense the rest of the OS is an operating system:
 * there is no filesystem underneath, only content/conversations.ts and the
 * .zip files `npm run samples` writes out of it. Opening a row hands the
 * conversation id to the simulator, which fetches the real zip and parses it
 * exactly as if you had dragged it in yourself — there is no shortcut path
 * that skips the importer.
 *
 * Plain System 7 throughout: this is OS chrome, not the WhatsApp interior.
 */
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { AppFrame, StatusBar, Toolbar, ToolbarLabel, ToolbarSpacer } from '@/components/os/ui';
import { useIsMobile } from '@/components/os/useIsMobile';
import { conversations, type MockConversation } from '@/content/conversations';
import { APP_ICONS } from '@/content/images';
import { useWindowStore } from '@/lib/os/windowStore';
import type { AppWindowProps } from '@/lib/os/types';

/** The name the file actually has on disk under /public/downloads. */
function fileName(conversation: MockConversation): string {
  return `${conversation.id}.zip`;
}

function formatSize(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

/**
 * Real sizes, read off the files themselves with a HEAD request rather than
 * baked into a generated manifest — one fewer artifact to keep in sync, and it
 * tells the truth when the samples have not been generated yet (the row shows
 * an em dash instead of a confident lie).
 *
 * Same-origin, so the offline guarantee in tests/offline.spec.ts is untouched.
 */
function useFileSizes(): Record<string, number | null> {
  const [sizes, setSizes] = useState<Record<string, number | null>>({});

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      conversations.map(async (c) => {
        try {
          const res = await fetch(`/downloads/${fileName(c)}`, { method: 'HEAD' });
          const len = res.ok ? res.headers.get('content-length') : null;
          return [c.id, len ? Number(len) : null] as const;
        } catch {
          return [c.id, null] as const;
        }
      }),
    ).then((entries) => {
      if (!cancelled) setSizes(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return sizes;
}

export default function DownloadsApp({ close }: AppWindowProps) {
  const isMobile = useIsMobile();
  const sizes = useFileSizes();
  const [selected, setSelected] = useState<string | null>(null);

  const open = (conversation: MockConversation) => {
    // Singleton, so a second sample re-uses the existing simulator window.
    useWindowStore.getState().openApp('whatsapp', { params: { load: conversation.id } });
    close();
  };

  const totalKnown = conversations.reduce((sum, c) => sum + (sizes[c.id] ?? 0), 0);

  return (
    <AppFrame
      toolbar={
        <Toolbar>
          <ToolbarLabel>
            {conversations.length} item{conversations.length === 1 ? '' : 's'}
          </ToolbarLabel>
          <ToolbarSpacer />
          <ToolbarLabel>
            {isMobile ? 'Tap to open' : 'Double-click to open'}
          </ToolbarLabel>
        </Toolbar>
      }
      status={
        <StatusBar>
          <span className="truncate">{formatSize(totalKnown || null)} in folder</span>
        </StatusBar>
      }
    >
      <ul className="divide-y divide-os-chrome-dark" role="list" data-testid="downloads-list">
        {conversations.map((conversation) => {
          const isSelected = selected === conversation.id;
          return (
            <li key={conversation.id}>
              <button
                type="button"
                className={[
                  'flex w-full items-start gap-2.5 px-2.5 py-2 text-left',
                  isSelected ? 'bg-os-accent text-white' : 'hover:bg-os-chrome',
                ].join(' ')}
                aria-label={`${fileName(conversation)} — ${conversation.title}`}
                onClick={() => {
                  // Mobile has no double-click; a single tap is the open
                  // gesture there, exactly as it is on the desktop icons.
                  if (isMobile) open(conversation);
                  else setSelected(conversation.id);
                }}
                onDoubleClick={() => open(conversation)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    open(conversation);
                  }
                }}
              >
                <Image
                  src={APP_ICONS.archive}
                  alt=""
                  width={32}
                  height={32}
                  className="pixelated mt-0.5 shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate font-[family-name:var(--font-os-body)] text-[12px] font-semibold">
                      {fileName(conversation)}
                    </span>
                    <span
                      className={`shrink-0 text-[10px] tabular-nums ${isSelected ? '' : 'text-os-ink-soft'}`}
                    >
                      {formatSize(sizes[conversation.id] ?? null)}
                    </span>
                  </span>
                  <span
                    className={`block truncate text-[12px] ${isSelected ? '' : 'text-os-ink'}`}
                  >
                    {conversation.title}
                  </span>
                  <span
                    className={`block text-[11px] leading-snug ${isSelected ? '' : 'text-os-ink-soft'}`}
                  >
                    {conversation.blurb}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </AppFrame>
  );
}
