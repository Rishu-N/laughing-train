'use client';

/**
 * The classic shell's own 1-bit widgets.
 *
 * OWNER: Classic Boot agent.
 *
 * CONTRACT-PHASE3.md §5 deliberately suspends the shared-primitive rule here
 * and only here: `components/os/ui` is beveled and colour-aware, and a bevel is
 * a 1987 idea. Everything below is black on white, square-cornered, and flat.
 * A "gray" is always a checkerboard of black pixels, never a gray value.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { WHITE_DITHER_STYLE } from '@/lib/classic/patterns';

/** Silkscreen, the pixel font. Unreadable above ~11px, so nothing here is. */
export const BIT_FONT = 'font-[family-name:var(--font-os-ui)]';

/* ------------------------------------------------------------- dithering ---- */

/**
 * Fakes a gray by laying a white checkerboard over black content — the only
 * honest way to dim something on a 1-bit display.
 */
export function Dithered({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`relative inline-block ${className}`}>
      {children}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={WHITE_DITHER_STYLE}
      />
    </span>
  );
}

/* --------------------------------------------------------------- button ----- */

export interface BitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The dialog's default action — gets the heavy outer ring. */
  primary?: boolean;
}

export function BitButton({
  primary = false,
  className = '',
  children,
  disabled,
  ...rest
}: BitButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={[
        BIT_FONT,
        'relative inline-flex cursor-default items-center justify-center border border-black',
        'bg-white px-3 py-[3px] text-[10px] leading-none text-black select-none',
        'active:bg-black active:text-white',
        'focus-visible:shadow-[inset_0_0_0_2px_#000] focus-visible:outline-none',
        primary ? 'shadow-[0_0_0_2px_#fff,0_0_0_3px_#000]' : '',
        disabled ? 'pointer-events-none' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {disabled ? <Dithered>{children}</Dithered> : children}
    </button>
  );
}

/* ---------------------------------------------------------------- keycap ---- */

/**
 * A square 1-bit key — the Calculator keypad and Key Caps both press the same
 * shape. Inverts on press, which is all the feedback a 1-bit machine had.
 */
export function BitKey({
  className = '',
  children,
  pressed = false,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { pressed?: boolean }) {
  return (
    <button
      type="button"
      className={[
        BIT_FONT,
        'flex cursor-default items-center justify-center border border-black',
        'text-[11px] leading-none select-none',
        'focus-visible:shadow-[inset_0_0_0_2px_#000] focus-visible:outline-none',
        pressed ? 'bg-black text-white' : 'bg-white text-black active:bg-black active:text-white',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ----------------------------------------------------------------- rules ---- */

/** A 1px hairline. The only divider a 1-bit UI gets. */
export function BitRule({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`h-px w-full bg-black ${className}`} />;
}

/** Sunken field / readout. No bevel — a plain box is period-correct. */
export function BitWell({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`border border-black bg-white ${className}`}>{children}</div>
  );
}
