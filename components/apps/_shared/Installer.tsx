'use client';

/**
 * The "what is this and what will it do" gate that fronts a newly installed app.
 *
 * COORDINATOR-OWNED. Both WhatsApp Simulator and WhisperFlow render through it,
 * so the two arrivals in the OS introduce themselves the same way instead of
 * each inventing a welcome screen.
 *
 * It deliberately does NOT live in components/os/ui — that barrel is frozen, and
 * this is a two-app convention rather than an OS-wide primitive.
 *
 * The System 7 installer it imitates was a plain dialog: an icon, a paragraph, a
 * list of what is about to happen, and one obvious button. Same here. It is
 * shown once per app (the answer is remembered via useAppSession under its own
 * key) and can always be summoned again from the app, which is why `onReplay`
 * exists on the consuming side rather than a "don't show again" checkbox here.
 *
 *   const [installed, setInstalled] = useAppSession('whatsapp:installed', false);
 *   if (!installed) return <Installer … onInstall={() => setInstalled(true)} />;
 */
import Image from 'next/image';
import type { ReactNode } from 'react';
import { Button } from '@/components/os/ui';

export interface InstallerRequirement {
  /** Short label, e.g. "Microphone". */
  label: string;
  /** Why it is needed, in one plain sentence. */
  detail: string;
  /**
   * False when the thing genuinely is not available right now (no API key, no
   * mic). Rendered as a caveat rather than hidden — a surprise later is worse.
   */
  available?: boolean;
}

export interface InstallerProps {
  /** App name, as the title of the installer sheet. */
  title: string;
  /** One line under the title. What it is, not how it works. */
  subtitle: string;
  /** Path from content/images.ts. */
  icon: string;
  /** The body: what the app does. Two or three short paragraphs at most. */
  children: ReactNode;
  /** Bulleted "this is what it will do / needs" list. */
  requirements?: InstallerRequirement[];
  /** Label for the confirm button. Defaults to "Install". */
  actionLabel?: string;
  onInstall: () => void;
  /** Optional secondary action, e.g. "Download the Mac app". */
  secondary?: ReactNode;
  /** Shown when the installer is re-opened from inside an already-installed app. */
  onDismiss?: () => void;
}

export function Installer({
  title,
  subtitle,
  icon,
  children,
  requirements = [],
  actionLabel = 'Install',
  onInstall,
  secondary,
  onDismiss,
}: InstallerProps) {
  return (
    <div className="os-scroll h-full w-full overflow-auto bg-os-chrome p-4">
      <div className="mx-auto max-w-[560px] border border-os-ink bg-os-face">
        {/* Header plate. */}
        <div className="flex items-start gap-3 border-b border-os-ink bg-os-chrome p-3">
          <Image src={icon} alt="" width={32} height={32} className="pixelated shrink-0" />
          <div className="min-w-0">
            <h1 className="os-chrome-text text-[11px] leading-tight text-os-ink">{title}</h1>
            <p className="mt-1 text-[12px] leading-snug text-os-ink-soft">{subtitle}</p>
          </div>
        </div>

        <div className="space-y-3 p-4 text-[13px] leading-relaxed text-os-ink">{children}</div>

        {requirements.length > 0 && (
          <div className="border-t border-os-chrome-dark px-4 pb-4">
            <h2 className="os-chrome-text mb-2 mt-3 text-[10px] text-os-ink-soft">
              This installer will
            </h2>
            <ul className="space-y-2">
              {requirements.map((req) => (
                <li key={req.label} className="flex gap-2 text-[12px] leading-snug">
                  <span aria-hidden className="mt-[2px] shrink-0 text-os-ink-soft">
                    {req.available === false ? '△' : '•'}
                  </span>
                  <span className="min-w-0">
                    <span className="font-semibold">{req.label}</span>
                    <span className="text-os-ink-soft"> — {req.detail}</span>
                    {req.available === false && (
                      <span className="text-os-warn"> (not available right now)</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-os-ink bg-os-chrome p-3">
          {secondary}
          {onDismiss && <Button onClick={onDismiss}>Back</Button>}
          <Button isDefault onClick={onInstall}>
            {actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Installer;
