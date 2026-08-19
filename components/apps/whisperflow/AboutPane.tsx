'use client';

/**
 * The description card: what WhisperFlow actually is, what this window can and
 * cannot be, and where to get the real thing.
 *
 * This is the pane that keeps the app honest. Everything a browser is not
 * allowed to do is listed with the reason, rather than quietly omitted, and the
 * download link sits at the top where it is impossible to miss.
 */
import Image from 'next/image';
import type { ReactNode } from 'react';
import { APP_ICONS } from '@/content/images';
import { LinkButton } from './LinkButton';
import { WHISPERFLOW } from './info';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-os-chrome-dark pt-3">
      <h3 className="os-chrome-text mb-2 text-[10px] text-os-ink-soft">{title}</h3>
      {children}
    </section>
  );
}

/**
 * The description card: what WhisperFlow actually is, what this window can and
 * cannot be, and where to get the real thing.
 */

export function AboutPane() {
  return (
    <div className="mx-auto max-w-[620px] space-y-4 p-4 text-[13px] leading-relaxed text-os-ink">
      <header className="flex items-start gap-3">
        <Image
          src={APP_ICONS.whisperflow}
          alt=""
          width={32}
          height={32}
          className="pixelated shrink-0"
        />
        <div className="min-w-0">
          <h2 className="os-chrome-text text-[11px] text-os-ink">{WHISPERFLOW.name}</h2>
          <p className="mt-1 text-[12px] text-os-ink-soft">{WHISPERFLOW.tagline}</p>
        </div>
      </header>

      {WHISPERFLOW.summary.map((paragraph) => (
        <p key={paragraph.slice(0, 24)}>{paragraph}</p>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <LinkButton href={WHISPERFLOW.releaseUrl} emphasis>
          Download for macOS
        </LinkButton>
        <LinkButton href={WHISPERFLOW.repoUrl}>View the repository</LinkButton>
        <span className="text-[11px] text-os-ink-soft">{WHISPERFLOW.requires}</span>
      </div>

      <p className="os-inset p-3 text-[12px] leading-snug text-os-ink-soft">
        {WHISPERFLOW.disclaimer}
      </p>

      <Section title="What the Mac app does that a web page cannot">
        <ul className="space-y-2">
          {WHISPERFLOW.nativeOnly.map((item) => (
            <li key={item.title} className="flex gap-2 text-[12px] leading-snug">
              <span aria-hidden className="mt-[2px] shrink-0 text-os-ink-soft">
                △
              </span>
              <span className="min-w-0">
                <span className="font-semibold">{item.title}</span>
                <span className="text-os-ink-soft"> — {item.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Permissions macOS will ask for">
        <ul className="space-y-1.5">
          {WHISPERFLOW.permissions.map((permission) => (
            <li key={permission.name} className="text-[12px] leading-snug">
              <span className="font-semibold">{permission.name}</span>
              <span className="text-os-ink-soft"> — {permission.why}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Installing it">
        <ol className="ml-4 list-decimal space-y-1.5 text-[12px] leading-snug">
          {WHISPERFLOW.installSteps.map((step) => (
            <li key={step.slice(0, 24)}>{step}</li>
          ))}
        </ol>
        <p className="mt-2 text-[11px] text-os-ink-soft">Or, in one line:</p>
        <pre className="os-inset os-scroll mt-1 overflow-x-auto p-2 font-[family-name:var(--font-os-mono)] text-[15px] leading-snug text-os-ink">
          {WHISPERFLOW.installCommand}
        </pre>
      </Section>

      <Section title="Scale">
        <p className="text-[12px] leading-snug text-os-ink-soft">
          {WHISPERFLOW.scale} The global shortcut is Carbon, capture and encoding are
          AVFoundation, insertion is Accessibility — none of which has a browser equivalent.
        </p>
      </Section>
    </div>
  );
}
