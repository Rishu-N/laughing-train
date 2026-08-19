'use client';

/**
 * WhisperFlow, as much of it as a browser is allowed to be.
 *
 * The real thing is a native macOS menu-bar app: hold a global shortcut
 * anywhere, speak, and the text is typed at your cursor in whatever application
 * you were using. A web page cannot register a system-wide hotkey and cannot
 * type into another application — that is the sandbox working as intended, not a
 * gap to be filled. So this window builds the half that genuinely does work in a
 * tab: press Record, speak, get a real transcript back, and have it land
 * somewhere useful.
 *
 * The layout follows the Mac app's MenuBarPanelView, top to bottom: what is
 * happening now, the text it produced, what you have said before. Transcript /
 * History / Settings are its panes; About is this port's addition, because a
 * demonstration that does not say what it is a demonstration of is just a lie
 * with a microphone button.
 *
 * Coupling: WhisperFlow writes to lib/os/dictation.ts and Notes reads from it.
 * The two apps do not import each other.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Installer, type InstallerRequirement } from '@/components/apps/_shared/Installer';
import {
  AppFrame,
  Button,
  StatusBar,
  Toolbar,
  ToolbarSeparator,
  ToolbarSpacer,
} from '@/components/os/ui';
import { APP_ICONS } from '@/content/images';
import { useDictationStore, type DictationSource } from '@/lib/os/dictation';
import { useAppSession } from '@/lib/os/persist';
import type { AppWindowProps } from '@/lib/os/types';
import { useWindowStore } from '@/lib/os/windowStore';
import { AboutPane } from './AboutPane';
import { HistoryPane } from './HistoryPane';
import { LinkButton } from './LinkButton';
import { SettingsPane } from './SettingsPane';
import { SourceBadge } from './SourceBadge';
import { RecordingDot, Waveform } from './Waveform';
import { WHISPERFLOW } from './info';
import { useDictation, type DictationPhase, type MicState } from './useDictation';

type Pane = 'transcript' | 'history' | 'settings' | 'about';

interface WhisperFlowSession {
  installed: boolean;
  /** Whether a finished transcript should open Notes if it is closed. */
  openNotes: boolean;
}

const EMPTY_SESSION: WhisperFlowSession = { installed: false, openNotes: true };

/** Failure states that mean pressing Record again will not help. */
const MIC_BLOCKED: MicState[] = ['denied', 'missing', 'unsupported', 'busy'];

/**
 * How long to wait for Notes to mount before emitting anyway. Generous on
 * purpose: Notes is a dynamic import, and on a cold dev server its chunk can
 * take seconds to compile. Emitting early loses the utterance; waiting only
 * delays the copy that Notes receives, since the transcript is already on
 * screen here.
 */
const SINK_TIMEOUT_MS = 8_000;

const HEADLINES: Record<DictationPhase, string> = {
  idle: 'Ready',
  arming: 'Waiting for the microphone…',
  recording: 'Recording…',
  transcribing: 'Transcribing…',
  typing: 'Replaying a scripted transcript…',
  failed: 'Stopped',
};

function elapsedLabel(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Wait for Notes to announce itself as the dictation sink.
 *
 * openApp() is synchronous but the app behind it is a dynamic import, so Notes
 * is not mounted — and not listening — for a beat afterwards. Emitting into that
 * gap loses the utterance silently, which is the worst possible failure for a
 * dictation app. The timeout means a Notes that never arrives costs a short
 * delay rather than the transcript.
 */
function waitForSink(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (useDictationStore.getState().sinkReady) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      unsubscribe();
      resolve();
    }, timeoutMs);
    const unsubscribe = useDictationStore.subscribe((state) => {
      if (!state.sinkReady) return;
      clearTimeout(timer);
      unsubscribe();
      resolve();
    });
  });
}

/** Segmented pane switcher, in the spirit of the panel's Transcript/History picker. */
function PaneTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`os-chrome-text rounded-[3px] px-2 py-[3px] text-[10px] leading-none ${
        active ? 'os-bevel-in' : 'os-bevel'
      }`}
    >
      {children}
    </button>
  );
}

export default function WhisperFlowApp({ appId }: AppWindowProps) {
  // Keyed off appId rather than a literal: this app's settings namespace is its
  // registry id, and nothing else in the session is persisted — not the
  // transcript, and certainly not any audio.
  const [session, setSession, , hydrated] = useAppSession<WhisperFlowSession>(
    appId,
    EMPTY_SESSION,
  );
  const [replayInstaller, setReplayInstaller] = useState(false);
  const [pane, setPane] = useState<Pane>('transcript');
  const [editor, setEditor] = useState('');
  const [copied, setCopied] = useState(false);

  const sinkReady = useDictationStore((s) => s.sinkReady);
  const lastEvent = useDictationStore((s) => s.last);

  // Read inside the delivery callback rather than closed over, so toggling the
  // setting mid-take takes effect for that take. Mirrored in an effect rather
  // than during render, the way lib/os/persist.ts does it — a render React
  // discards must not leave a ref behind.
  const openNotesRef = useRef(session.openNotes);
  useEffect(() => {
    openNotesRef.current = session.openNotes;
  }, [session.openNotes]);

  /**
   * Hand a finished utterance to the rest of the OS.
   *
   * Notes is opened BEFORE the emit rather than after, because the store only
   * carries the delta — a consumer that mounts late never sees it.
   */
  const deliver = useCallback(async (text: string, source: DictationSource) => {
    if (openNotesRef.current && !useDictationStore.getState().sinkReady) {
      // Deliberately here and not at the start of the take: on a phone every
      // window is full-screen, so raising Notes while you are still recording
      // would bury the Stop button. The wait below is what makes the later open
      // safe instead.
      useWindowStore.getState().openApp('notes');
      await waitForSink(SINK_TIMEOUT_MS);
    }
    useDictationStore.getState().emit(text, source);
  }, []);

  const handleUtterance = useCallback(
    (text: string, source: DictationSource) => {
      setEditor((prev) => (prev ? `${prev.replace(/\s*$/, '')}\n${text}` : text));
      void deliver(text, source);
    },
    [deliver],
  );

  const dictation = useDictation(handleUtterance);
  const {
    mode,
    setMode,
    phase,
    notice,
    mic,
    levels,
    elapsedMs,
    caps,
    pending,
    busy,
    start,
    stop,
    cancel,
    dismissNotice,
  } = dictation;

  const recording = phase === 'recording' || phase === 'arming';
  const micBlocked = MIC_BLOCKED.includes(mic);

  // The typewriter's partial line is shown in place, but never committed to the
  // editor until the utterance completes.
  const displayText = pending ? (editor ? `${editor}\n${pending}` : pending) : editor;

  const words = useMemo(() => {
    const trimmed = displayText.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [displayText]);

  const micPossible = useMemo(
    () => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia),
    [],
  );

  const copy = useCallback(() => {
    if (!displayText) return;
    navigator.clipboard
      ?.writeText(displayText)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1_500);
      })
      .catch(() => {
        // Clipboard permission refused, or an insecure context. Not worth an
        // alert — the text is still on screen and selectable.
      });
  }, [displayText]);

  /* ------------------------------------------------------------ installer -- */

  if (!hydrated) {
    return (
      <AppFrame>
        <p className="p-4 text-[12px] text-os-ink-soft">Starting {WHISPERFLOW.name}…</p>
      </AppFrame>
    );
  }

  if (!session.installed || replayInstaller) {
    const requirements: InstallerRequirement[] = [
      {
        label: 'Microphone',
        detail:
          'Recording starts only when you press Record and stops when you stop it. The audio is uploaded once and never stored.',
        available: micPossible ? undefined : false,
      },
      {
        label: 'Live transcription',
        detail:
          'Audio is posted to this site’s own server, which forwards it to Whisper. The key stays on the server and never reaches this page.',
        available: caps.probed ? caps.live : undefined,
      },
      {
        label: 'Demo mode',
        detail:
          'Replays scripted transcripts with no microphone, no key and no network. Always available, and clearly labelled as demo wherever it appears.',
      },
      {
        label: 'Notes',
        detail:
          'Finished transcripts are appended to the Notes app, which opens by itself if it is closed.',
      },
    ];

    return (
      <Installer
        title={WHISPERFLOW.name}
        subtitle={WHISPERFLOW.tagline}
        icon={APP_ICONS.whisperflow}
        requirements={requirements}
        actionLabel={session.installed ? 'Continue' : 'Install'}
        onInstall={() => {
          setSession((prev) => ({ ...prev, installed: true }));
          setReplayInstaller(false);
        }}
        onDismiss={session.installed ? () => setReplayInstaller(false) : undefined}
        secondary={<LinkButton href={WHISPERFLOW.releaseUrl}>Download the Mac app</LinkButton>}
      >
        <p>
          The real {WHISPERFLOW.name} is a native macOS menu-bar app: hold {WHISPERFLOW.hotkey}{' '}
          anywhere, speak, and the text is typed straight into whatever application you were
          using.
        </p>
        <p>
          This window is the half of it that works in a browser — record, transcribe, and hand the
          words to Notes. The global shortcut, typing at your cursor and local noise suppression
          all need a real Mac app, and About explains why.
        </p>
      </Installer>
    );
  }

  /* ----------------------------------------------------------------- app --- */

  return (
    <AppFrame
      scroll={false}
      toolbar={
        // The name and the shortcut chip are the panel's header in the Mac app,
        // but at 375px the tabs need every pixel — so they stand down first.
        <Toolbar className="flex-wrap">
          <span className="os-chrome-text hidden text-[10px] sm:inline">{WHISPERFLOW.name}</span>
          <span
            title="Global shortcut — macOS app only. A web page only receives keys while its own tab has focus."
            className="os-bevel os-chrome-text hidden rounded-[3px] px-1 py-[2px] text-[9px] leading-none text-os-disabled sm:inline-block"
          >
            {WHISPERFLOW.hotkey}
          </span>
          <ToolbarSeparator />
          <PaneTab active={pane === 'transcript'} onClick={() => setPane('transcript')}>
            Transcript
          </PaneTab>
          <PaneTab active={pane === 'history'} onClick={() => setPane('history')}>
            History
          </PaneTab>
          <PaneTab active={pane === 'settings'} onClick={() => setPane('settings')}>
            Settings
          </PaneTab>
          <PaneTab active={pane === 'about'} onClick={() => setPane('about')}>
            About
          </PaneTab>
          <ToolbarSpacer />
          <SourceBadge source={mode} />
        </Toolbar>
      }
      status={
        <StatusBar>
          <span>{HEADLINES[phase]}</span>
          {recording && <span className="text-os-alert">{elapsedLabel(elapsedMs)}</span>}
          <ToolbarSpacer />
          <span className="truncate text-os-ink-soft">
            {sinkReady ? 'Notes is listening' : 'Notes opens on the first transcript'}
          </span>
        </StatusBar>
      }
    >
      <div className="flex h-full min-h-0 w-full flex-col">
        {/* Recorder strip — the Mac panel's top row. */}
        <div
          data-recording={recording ? 'true' : 'false'}
          className={`flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2 ${
            recording ? 'border-os-alert bg-os-face' : 'border-os-chrome-dark bg-os-chrome'
          }`}
        >
          <button
            type="button"
            onClick={recording ? stop : start}
            disabled={busy && !recording}
            aria-label={
              recording
                ? 'Stop recording'
                : mode === 'demo'
                  ? 'Play a demo dictation'
                  : 'Start recording'
            }
            className={`flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full border border-os-ink text-[14px] leading-none ${
              recording ? 'bg-os-alert text-os-face' : 'os-bevel active:os-bevel-in'
            } ${busy && !recording ? 'text-os-disabled' : ''}`}
          >
            <span aria-hidden>{recording ? '■' : '●'}</span>
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {recording && <RecordingDot />}
              <span
                className={`os-chrome-text text-[11px] ${recording ? 'text-os-alert' : 'text-os-ink'}`}
              >
                {recording ? 'RECORDING' : HEADLINES[phase]}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-os-ink-soft">
              {recording
                ? mode === 'demo'
                  ? 'Nothing is being recorded — this is the scripted demo.'
                  : 'The microphone is live. Text appears below, and in Notes.'
                : mode === 'demo'
                  ? 'Demo mode: scripted transcripts, no microphone, no network.'
                  : `Press Record and speak. Transcribed by ${caps.model || 'Whisper'}.`}
            </p>
          </div>

          {(recording || phase === 'transcribing') && (
            <Waveform levels={levels} active={recording} className="w-[110px] shrink-0" />
          )}
          {(recording || busy) && <Button onClick={cancel}>Cancel</Button>}
        </div>

        {notice && (
          <div
            role="status"
            className={`flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-1.5 text-[11px] leading-snug ${
              phase === 'failed'
                ? 'border-os-alert bg-os-face text-os-alert'
                : 'border-os-chrome-dark bg-os-chrome text-os-ink-soft'
            }`}
          >
            <span className="min-w-0 flex-1">{notice}</span>
            {micBlocked && mode === 'live' && (
              <Button onClick={() => setMode('demo')}>Use demo mode</Button>
            )}
            <Button onClick={dismissNotice}>OK</Button>
          </div>
        )}

        <div className="os-scroll min-h-0 flex-1 overflow-auto">
          {pane === 'transcript' && (
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex shrink-0 items-center gap-2 border-b border-os-chrome-dim bg-os-chrome px-2 py-1">
                <SourceBadge source={mode} />
                <span className="os-chrome-text truncate text-[10px] text-os-ink-soft">
                  {mode === 'demo'
                    ? 'Scripted text — nothing is recorded and nothing is sent'
                    : `Transcribed from the microphone by ${caps.model || 'Whisper'}`}
                </span>
              </div>

              <textarea
                aria-label="Transcript"
                value={displayText}
                readOnly={phase === 'typing'}
                spellCheck={false}
                placeholder="Dictate with this window open and the text lands here — and in Notes."
                onChange={(event) => setEditor(event.target.value)}
                className="os-scroll min-h-0 flex-1 resize-none bg-os-face px-2 py-2 font-[family-name:var(--font-os-body)] text-[13px] leading-relaxed text-os-ink outline-none"
              />

              <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-os-chrome-dim bg-os-chrome px-2 py-1">
                <span className="os-chrome-text text-[10px] text-os-ink-soft">
                  {words} {words === 1 ? 'word' : 'words'}
                </span>
                {lastEvent?.source === 'demo' && (
                  <span className="os-chrome-text text-[10px] text-os-warn">
                    last line was scripted
                  </span>
                )}
                <ToolbarSpacer />
                <Button disabled={!displayText} onClick={() => setEditor('')}>
                  Clear
                </Button>
                <Button disabled={!displayText} onClick={copy}>
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          )}

          {pane === 'history' && (
            <HistoryPane
              onInsert={(text) =>
                setEditor((prev) => (prev ? `${prev.replace(/\s*$/, '')}\n${text}` : text))
              }
            />
          )}

          {pane === 'settings' && (
            <SettingsPane
              mode={mode}
              onModeChange={setMode}
              caps={caps}
              mic={mic}
              sendToNotes={session.openNotes}
              onSendToNotesChange={(next) => setSession((prev) => ({ ...prev, openNotes: next }))}
              sinkReady={sinkReady}
              onShowInstaller={() => setReplayInstaller(true)}
            />
          )}

          {pane === 'about' && <AboutPane />}
        </div>
      </div>
    </AppFrame>
  );
}
