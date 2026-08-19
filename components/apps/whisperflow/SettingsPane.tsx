'use client';

/**
 * Settings, grouped the way the Mac app's Settings window is: General, Shortcut,
 * Audio, Server, Cleanup.
 *
 * Two of those groups contain nothing you can change, and that is deliberate.
 * Noise suppression and LLM cleanup are real features of the real app; showing
 * them greyed out with the reason is more honest than pretending WhisperFlow is
 * only what fits in a browser tab. Nothing here is a fake toggle — every control
 * that can be moved does something.
 */
import { Button, Checkbox, FieldGroup, Radio } from '@/components/os/ui';
import { WHISPERFLOW } from './info';
import type { DictationMode, MicState, WhisperCapabilities } from './useDictation';

const MIC_LABELS: Record<MicState, string> = {
  unknown: 'Not requested yet',
  granted: 'Allowed',
  denied: 'Blocked in this browser’s site settings',
  dismissed: 'Prompt dismissed — you will be asked again',
  missing: 'No microphone attached',
  busy: 'In use by another application',
  unsupported: 'Not available on this page',
};

function Row({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-[3px]">
      <span className="os-chrome-text w-[104px] shrink-0 text-[10px] text-os-ink-soft">
        {label}
      </span>
      <span className={`min-w-0 text-[12px] leading-snug ${muted ? 'text-os-disabled' : 'text-os-ink'}`}>
        {value}
      </span>
    </div>
  );
}

export interface SettingsPaneProps {
  mode: DictationMode;
  onModeChange: (mode: DictationMode) => void;
  caps: WhisperCapabilities;
  mic: MicState;
  sendToNotes: boolean;
  onSendToNotesChange: (next: boolean) => void;
  sinkReady: boolean;
  onShowInstaller: () => void;
}

export function SettingsPane({
  mode,
  onModeChange,
  caps,
  mic,
  sendToNotes,
  onSendToNotesChange,
  sinkReady,
  onShowInstaller,
}: SettingsPaneProps) {
  return (
    <div className="space-y-3 p-3">
      <FieldGroup title="General" className="space-y-2">
        <div className="space-y-1.5">
          <Radio
            name="whisperflow-mode"
            label="Live dictation — record the microphone and transcribe it"
            checked={mode === 'live'}
            disabled={!caps.live}
            onChange={() => onModeChange('live')}
          />
          <Radio
            name="whisperflow-mode"
            label="Demo mode — replay scripted transcripts, no microphone, no network"
            checked={mode === 'demo'}
            onChange={() => onModeChange('demo')}
          />
        </div>
        {!caps.live && caps.probed && (
          <p className="text-[11px] leading-snug text-os-warn">
            Live dictation is off because this server has no transcription key configured. Demo
            mode is the only option here, and it is fully explorable.
          </p>
        )}
        <Checkbox
          label="Open Notes for finished transcripts"
          checked={sendToNotes}
          onChange={(event) => onSendToNotesChange(event.target.checked)}
        />
        <Row
          label="Notes"
          value={
            sinkReady
              ? 'Open and listening — dictation lands in it live.'
              : 'Closed. It opens by itself when the first transcript is ready.'
          }
        />
        <p className="text-[11px] leading-snug text-os-ink-soft">
          Notes always receives dictation while it is open. This setting only controls whether it
          gets opened for you.
        </p>
      </FieldGroup>

      <FieldGroup title="Shortcut" className="space-y-1">
        <Row label="Global hotkey" value={`${WHISPERFLOW.hotkey} — macOS app only`} muted />
        <p className="text-[11px] leading-snug text-os-ink-soft">
          A web page only receives keys while its own tab has focus, so there is nothing to bind
          here. The Mac app registers the shortcut system-wide through Carbon.
        </p>
      </FieldGroup>

      <FieldGroup title="Audio" className="space-y-1">
        <Row label="Microphone" value={MIC_LABELS[mic]} />
        <Row label="Noise suppression" value="Apple Voice Processing / RNNoise — macOS app only" muted />
        <p className="text-[11px] leading-snug text-os-ink-soft">
          The Mac app denoises the raw audio before anything is uploaded. Nothing of the kind is
          attempted here — the recording is encoded and sent as captured.
        </p>
      </FieldGroup>

      <FieldGroup title="Server" className="space-y-1">
        <Row label="Endpoint" value="/api/whisper — this site’s own server" />
        <Row
          label="Upstream"
          value="api.openai.com/v1/audio/transcriptions, called from the server"
        />
        <Row label="Model" value={caps.model || 'unknown until the server answers'} />
        <Row
          label="API key"
          value={
            caps.live
              ? 'Configured server-side. It is never sent to this page.'
              : 'Not configured. Set OPENAI_API_KEY on the server to enable live dictation.'
          }
        />
        <p className="text-[11px] leading-snug text-os-ink-soft">
          The browser never talks to OpenAI directly. Audio is POSTed to this site, and the server
          makes the outbound call — which is also what keeps this page free of cross-origin
          requests.
        </p>
      </FieldGroup>

      <FieldGroup title="Cleanup" className="space-y-1">
        <Row label="LLM cleanup" value="Off — macOS app only" muted />
        <p className="text-[11px] leading-snug text-os-ink-soft">
          The Mac app can hand a transcript to a chat model to strip filler words and false starts,
          with an editable library of prompts. Not built here; what you see is the raw transcript.
        </p>
      </FieldGroup>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button onClick={onShowInstaller}>Show installer again</Button>
      </div>
    </div>
  );
}
