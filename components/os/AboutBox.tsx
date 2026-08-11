'use client';

/**
 * "About This Macintosh" — the System 7 about box, complete with a memory map
 * that fills up as you open more apps.
 *
 * OWNER: OS Shell agent. It lives under components/os/ rather than
 * components/apps/ because it is shell furniture: it reports on the OS itself.
 *
 * Every human-authored string here comes from content/bio.ts. The numbers are
 * chrome — a joke readout, not data anyone maintains.
 */
import Image from 'next/image';
import { bio } from '@/content/bio';
import { SYSTEM_IMAGES } from '@/content/images';
import { getApp } from '@/lib/os/registry';
import { useWindowStore } from '@/lib/os/windowStore';
import type { AppWindowProps } from '@/lib/os/types';
import { AppFrame } from './ui';

/** Fake machine spec. Chrome copy, deliberately not in content/. */
const SYSTEM_VERSION = '7.5.3';
const TOTAL_K = 32_768;
const SYSTEM_K = 3_584;

const fmtK = (k: number) => `${k.toLocaleString('en-US')}K`;

/** Deterministic "footprint" for an app, derived from its default window area. */
function appFootprintK(appId: string): number {
  const def = getApp(appId);
  if (!def) return 512;
  const area = def.defaultSize.width * def.defaultSize.height;
  return Math.max(512, Math.round(area / 256 / 64) * 64);
}

export default function AboutBox({}: AppWindowProps) {
  const windows = useWindowStore((s) => s.windows);

  const rows = windows.map((w) => ({
    key: w.instanceId,
    label: w.title,
    icon: getApp(w.appId)?.icon,
    kb: appFootprintK(w.appId),
  }));

  const usedK = SYSTEM_K + rows.reduce((sum, r) => sum + r.kb, 0);
  const freeK = Math.max(TOTAL_K - usedK, 0);

  return (
    <AppFrame scroll={false} className="bg-os-chrome">
      <div className="flex h-full flex-col gap-3 p-4">
        {/* ── header ──────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3">
          <Image
            src={SYSTEM_IMAGES.logo}
            alt=""
            width={40}
            height={40}
            className="pixelated shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] leading-tight os-chrome-text">{bio.name}</p>
            <p className="mt-1 text-[12px] leading-snug text-os-ink-soft">{bio.tagline}</p>
          </div>
          <p className="shrink-0 text-right text-[9px] leading-tight text-os-ink-soft os-chrome-text">
            System
            <br />
            {SYSTEM_VERSION}
          </p>
        </div>

        {(bio.status || bio.location) && (
          <p className="text-[11px] leading-snug text-os-ink-soft">
            {[bio.status, bio.location].filter(Boolean).join(' · ')}
          </p>
        )}

        <div aria-hidden className="h-px shrink-0 bg-os-ink" />

        {/* ── memory readout ──────────────────────────────────────────── */}
        <dl className="grid shrink-0 grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[10px] os-chrome-text">
          <dt className="text-os-ink-soft">Total Memory</dt>
          <dd className="text-right tabular-nums">{fmtK(TOTAL_K)}</dd>
          <dt className="text-os-ink-soft">Largest Unused Block</dt>
          <dd className="text-right tabular-nums">{fmtK(freeK)}</dd>
        </dl>

        <ul className="os-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
          <MemoryRow label="System Software" kb={SYSTEM_K} />
          {rows.map((r) => (
            <MemoryRow key={r.key} label={r.label} kb={r.kb} icon={r.icon} />
          ))}
          {rows.length === 0 && (
            <li className="pt-1 text-[10px] text-os-ink-soft os-chrome-text">
              No applications open.
            </li>
          )}
        </ul>
      </div>
    </AppFrame>
  );
}

function MemoryRow({ label, kb, icon }: { label: string; kb: number; icon?: string }) {
  const pct = Math.min((kb / TOTAL_K) * 100, 100);
  return (
    <li className="flex items-center gap-2">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {icon ? (
          <Image src={icon} alt="" width={16} height={16} className="pixelated" />
        ) : (
          <span aria-hidden className="block h-2 w-2 border border-os-ink bg-os-face" />
        )}
      </span>
      <span className="w-[92px] shrink-0 truncate text-[10px] os-chrome-text">{label}</span>
      <span className="os-inset h-[9px] flex-1 overflow-hidden rounded-[1px]">
        <span
          aria-hidden
          className="block h-full bg-os-accent"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="w-[52px] shrink-0 text-right text-[9px] tabular-nums os-chrome-text">
        {fmtK(kb)}
      </span>
    </li>
  );
}
