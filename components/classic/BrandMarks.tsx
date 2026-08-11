'use client';

/**
 * The two brand marks the classic front door uses.
 *
 * OWNER: Classic Boot agent — but the ART is the Brand agent's, arriving at the
 * paths in BRAND_IMAGES. This file codes against those paths and degrades to a
 * drawn-in-place 1-bit stand-in if the file isn't there yet, so the shell never
 * shows a broken-image box while the two agents land in parallel.
 *
 * ⚠️ Never Apple's logo, in either the asset or the fallback. The mark is an
 * original blocky disk; the wordmark falls back to the owner's name set in the
 * pixel font, read from content/bio.ts rather than hardcoded.
 */
import Image from 'next/image';
import { useState } from 'react';
import { ICON_DISK } from '@/components/classic/icons';
import { BIT_FONT } from '@/components/classic/ui/Bit';
import PixelIcon from '@/components/classic/ui/PixelIcon';
import { bio } from '@/content/bio';
import { BRAND_IMAGES } from '@/content/images';

export interface ClassicMarkProps {
  size?: number;
  className?: string;
}

/** The 1-bit mark: menu-bar title, startup plate, and the update transition. */
export function ClassicMark({ size = 16, className }: ClassicMarkProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className={className} style={{ display: 'block' }}>
        <PixelIcon map={ICON_DISK} size={size} />
      </span>
    );
  }

  return (
    <Image
      src={BRAND_IMAGES.classicMark}
      alt=""
      width={size}
      height={size}
      unoptimized
      // This is the first thing on screen on every visit — it is the LCP
      // element, so it must not wait for lazy loading.
      priority
      className={`pixelated ${className ?? ''}`}
      onError={() => setFailed(true)}
    />
  );
}

/**
 * Intrinsic size of brand/rishu-inc.svg. Keep in step with
 * scripts/generate-brand.mjs — the lockup distorts if these drift.
 */
const WORDMARK_W = 228;
const WORDMARK_H = 52;

export interface WordmarkProps {
  /** Width in px; the wordmark is a landscape lockup. */
  width?: number;
  className?: string;
}

/** The "Rishu Inc" wordmark that resolves in at the end of the update. */
export function RishuIncWordmark({ width = 260, className }: WordmarkProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`${BIT_FONT} flex flex-col items-center gap-2 text-black ${className ?? ''}`}
        style={{ width }}
      >
        <span className="text-center text-[16px] leading-tight tracking-[0.22em] break-words uppercase">
          {bio.name}
        </span>
        <span aria-hidden="true" className="h-px w-full bg-black" />
        <span className="text-[9px] leading-none tracking-[0.5em] uppercase">
          Inc.
        </span>
      </div>
    );
  }

  return (
    <Image
      src={BRAND_IMAGES.rishuInc}
      alt=""
      width={width}
      // Derived from the asset's real 228x52 viewBox. A guessed ratio here both
      // distorts the lockup and makes next/image warn that one dimension was
      // changed without the other.
      height={Math.round(width * (WORDMARK_H / WORDMARK_W))}
      unoptimized
      className={`pixelated ${className ?? ''}`}
      onError={() => setFailed(true)}
    />
  );
}
