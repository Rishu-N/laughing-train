'use client';

/**
 * WhatsApp Simulator — a standalone Vite app, moved into the OS as a window.
 *
 * The port kept the original's structure (lib/parse, lib/export, lib/layout,
 * workers, state, components) so it can still be diffed against the project it
 * came from. Three things are genuinely different, and all three are about
 * living inside an operating system rather than owning a browser tab:
 *
 *   • CHROME IS THE OS'S. Search, filters and export were WhatsApp-green icon
 *     buttons in the chat header; here they are a System 7 toolbar, and the
 *     export sheet is the shared <Dialog>. The conversation itself is
 *     untouched — a 2010s messaging UI inside a 1991 window is the joke, the
 *     same one the Browser app makes with its 1996 web page.
 *   • THE PALETTE IS SEALED. See the header of whatsapp.css.
 *   • IT INTRODUCES ITSELF. First launch shows the shared <Installer>, because
 *     an app that silently starts reading .zip files off your desk deserves to
 *     say what it does with them first.
 */
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  AppFrame,
  Button,
  IconButton,
  StatusBar,
  Toolbar,
  ToolbarSeparator,
  ToolbarSpacer,
} from '@/components/os/ui';
import { Installer } from '@/components/apps/_shared/Installer';
import { APP_ICONS } from '@/content/images';
import { conversations } from '@/content/conversations';
import { useAppSession } from '@/lib/os/persist';
import type { AppWindowProps } from '@/lib/os/types';
import { AppProvider, useApp } from './state/AppContext';
import { LightboxProvider } from './state/LightboxContext';
import { Sidebar } from './components/Sidebar';
import { SettingsPanel } from './components/SettingsPanel';
import { ChatView } from './components/ChatView';
import { Lightbox } from './components/Lightbox';
import { ExportDialog } from './components/ExportDialog';
import { DownloadIcon, ListIcon, SearchIcon, SlidersIcon } from './components/Icons';
import './whatsapp.css';

/** Persisted separately from the chats themselves — clearing history should
 * not make the app re-introduce itself. */
const INSTALLED_KEY = 'whatsapp:installed';

function Shell({
  loadId,
  setTitle,
  onShowInstaller,
}: {
  loadId?: string;
  setTitle: (t: string) => void;
  onShowInstaller: () => void;
}) {
  const app = useApp();
  const [searchOpen, setSearchOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  // Opened straight onto a chat from the Downloads folder? Then the chat is
  // what was asked for; the list can stay out of the way.
  const [sidebarOpen, setSidebarOpen] = useState(!loadId);
  const autoLoaded = useRef(false);

  // Opened from the Downloads folder with `params: { load: '<id>' }`. Fires
  // once per window; a second run would re-activate a chat the visitor may
  // have since navigated away from.
  useEffect(() => {
    if (autoLoaded.current || !loadId) return;
    autoLoaded.current = true;
    const conversation = conversations.find((c) => c.id === loadId);
    if (conversation) void app.loadSample(conversation);
    // `app` is a fresh object each render; depending on it would re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadId]);

  // The window's title bar tracks the open chat, the way Notes tracks its
  // first line.
  const chatName = app.activeRecord?.name;
  useEffect(() => {
    setTitle(chatName ? `WhatsApp — ${chatName}` : 'WhatsApp Simulator');
  }, [chatName, setTitle]);

  const hasChat = app.activeChatId !== null;
  const visible = app.visibleRange.end - app.visibleRange.start;

  return (
    <AppFrame
      scroll={false}
      toolbar={
        <Toolbar>
          <IconButton
            label="Chat list"
            active={sidebarOpen}
            onClick={() => setSidebarOpen((v) => !v)}
          >
            <ListIcon size={14} />
          </IconButton>
          <ToolbarSeparator />
          <IconButton
            label="Filters and settings"
            active={app.settingsPanelOpen}
            onClick={app.toggleSettingsPanel}
          >
            <SlidersIcon size={14} />
          </IconButton>
          <IconButton
            label="Find in chat"
            active={searchOpen}
            disabled={!hasChat}
            onClick={() => setSearchOpen((v) => !v)}
          >
            <SearchIcon size={14} />
          </IconButton>
          <IconButton label="Export chat" disabled={!hasChat} onClick={() => setExportOpen(true)}>
            <DownloadIcon size={14} />
          </IconButton>
          <ToolbarSpacer />
          <Button onClick={onShowInstaller}>About</Button>
        </Toolbar>
      }
      status={
        <StatusBar>
          <span className="truncate">
            {hasChat ? `${visible.toLocaleString()} messages shown` : 'No chat open'}
          </span>
          <ToolbarSpacer />
          <span className="hidden truncate sm:inline">Nothing leaves this browser</span>
        </StatusBar>
      }
    >
      <div className="whatsapp-app" data-theme={app.settings.theme}>
        <div className={`app-shell${sidebarOpen ? ' sidebar-open' : ''}`}>
          <Sidebar onClose={() => setSidebarOpen(false)} />
          {/* Only rendered as a click target in the narrow layout, where the
              sidebar floats over the chat instead of sitting beside it. */}
          <button
            type="button"
            className="sidebar-scrim"
            aria-label="Close chat list"
            onClick={() => setSidebarOpen(false)}
          />
          <SettingsPanel />
          <ChatView searchOpen={searchOpen} />
          <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
          <Lightbox />
        </div>
      </div>
    </AppFrame>
  );
}

export default function WhatsAppApp({ params, setTitle }: AppWindowProps) {
  const [installed, setInstalled, , hydrated] = useAppSession<boolean>(INSTALLED_KEY, false);
  const [replaying, setReplaying] = useState(false);

  // Nothing until the stored answer is known — otherwise the installer flashes
  // on every launch for someone who dismissed it months ago.
  if (!hydrated) return <div className="h-full w-full bg-os-face" />;

  if (!installed || replaying) {
    return (
      <Installer
        title="WhatsApp Chat Simulator"
        subtitle="Read a WhatsApp export, replay it, print it."
        icon={APP_ICONS.whatsapp}
        actionLabel={installed ? 'Continue' : 'Install'}
        onInstall={() => {
          setInstalled(true);
          setReplaying(false);
        }}
        onDismiss={installed ? () => setReplaying(false) : undefined}
        requirements={[
          {
            label: 'Read .zip exports',
            detail:
              'WhatsApp’s own "Export chat" file, from iOS or Android. Drop one in, or open one of the samples in the Downloads folder.',
          },
          {
            label: 'Stay on this machine',
            detail:
              'Parsing, media and history all live in this browser. Nothing is uploaded, and there is no server to upload it to.',
          },
          {
            label: 'Use browser storage',
            detail:
              'Imported chats and their media are kept in IndexedDB so they are still here next visit. Deleting a chat removes both.',
          },
        ]}
        secondary={
          <span className="mr-auto flex items-center gap-2 text-[11px] text-os-ink-soft">
            <Image
              src={APP_ICONS.archive}
              alt=""
              width={16}
              height={16}
              className="pixelated"
            />
            Samples live in Downloads
          </span>
        }
      >
        <p>
          Point it at a WhatsApp chat export and it replays the conversation the way the app drew
          it — bubbles, tails, date dividers, read ticks, the lot — then lets you narrow it to a
          date range and save the result as a PDF, a PNG, or a single self-contained HTML file.
        </p>
        <p>
          Photos, videos, voice notes, stickers, documents, contact cards, calls, edits and
          deletions all come through. Media that the export left out is drawn as a labelled
          placeholder rather than a broken image.
        </p>
        <p>
          Parsing runs in a Web Worker and the message list is virtualised, so a chat with a
          couple of hundred thousand messages scrolls without the window locking up.
        </p>
      </Installer>
    );
  }

  return (
    <AppProvider>
      <LightboxProvider>
        <Shell
          loadId={params?.load}
          setTitle={setTitle}
          onShowInstaller={() => setReplaying(true)}
        />
      </LightboxProvider>
    </AppProvider>
  );
}
