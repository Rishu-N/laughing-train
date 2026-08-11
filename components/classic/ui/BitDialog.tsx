'use client';

/**
 * A 1-bit modal alert: doubled outline, an icon, a line of text, one button.
 *
 * OWNER: Classic Boot agent.
 *
 * No dimmed backdrop — 1984 had no alpha compositing. The backdrop here is
 * invisible and exists only to swallow clicks, which is what actually made a
 * modal modal on that machine.
 */
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { BIT_FONT, BitButton } from '@/components/classic/ui/Bit';
import PixelIcon from '@/components/classic/ui/PixelIcon';
import type { PixelMap } from '@/components/classic/icons';
import { CLASSIC_LAYERS } from '@/lib/classic/metrics';

export interface BitDialogProps {
  title: string;
  icon?: PixelMap;
  children: ReactNode;
  confirmLabel?: string;
  onClose: () => void;
}

export default function BitDialog({
  title,
  icon,
  children,
  confirmLabel = 'OK',
  onClose,
}: BitDialogProps) {
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    okRef.current?.focus({ preventScroll: true });
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <div
      className="absolute inset-0 flex items-center justify-center p-4"
      style={{ zIndex: CLASSIC_LAYERS.dialog }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={onKeyDown}
        className={`${BIT_FONT} w-[min(320px,100%)] border-2 border-black bg-white text-black`}
      >
        <div className="border border-black bg-white p-3">
          <div className="flex gap-3">
            {icon && (
              <div className="shrink-0 pt-[2px] text-black">
                <PixelIcon map={icon} size={32} />
              </div>
            )}
            <div className="min-w-0 flex-1 text-[10px] leading-[1.6]">{children}</div>
          </div>
          <div className="mt-4 flex justify-end">
            <BitButton ref={okRef} primary onClick={onClose}>
              {confirmLabel}
            </BitButton>
          </div>
        </div>
      </div>
    </div>
  );
}
