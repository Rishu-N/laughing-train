'use client';

/**
 * System 7 modal alert, scoped to the window that raised it (not the whole page).
 *
 * SHARED PRIMITIVE — read-only for Phase 1 agents.
 *
 * The parent window must be `relative` — Dialog fills its nearest positioned
 * ancestor, so a Notes alert dims Notes, not the desktop.
 *
 *   const [asking, setAsking] = useState(false);
 *   {asking && (
 *     <ConfirmDialog
 *       message="Discard the current note?"
 *       confirmLabel="New"
 *       onConfirm={() => { reset(); setAsking(false); }}
 *       onCancel={() => setAsking(false)}
 *     />
 *   )}
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './Button';

export interface DialogProps {
  title?: string;
  children: ReactNode;
  /** Rendered bottom-right. Put the default action last. */
  actions?: ReactNode;
  /** Called on Escape and on backdrop click. */
  onDismiss?: () => void;
  width?: number;
}

export function Dialog({ title, children, actions, onDismiss, width = 320 }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/25 p-4"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onDismiss?.();
      }}
    >
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-label={title ?? 'Alert'}
        tabIndex={-1}
        className="os-window max-w-full rounded-[3px] p-4 outline-none"
        style={{ width }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onDismiss?.();
          }
        }}
      >
        <div className="flex gap-3">
          {/* The classic caution triangle. */}
          <div aria-hidden className="mt-0.5 shrink-0 text-[26px] leading-none">
            ⚠️
          </div>
          <div className="min-w-0 flex-1">
            {title && (
              <div className="mb-1 text-[12px] font-bold os-chrome-text">{title}</div>
            )}
            <div className="text-[12px] leading-snug">{children}</div>
          </div>
        </div>
        {actions && <div className="mt-4 flex justify-end gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export interface ConfirmDialogProps {
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** The common case: a destructive action needing an OK/Cancel. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      title={title}
      onDismiss={onCancel}
      actions={
        <>
          <Button onClick={onCancel}>{cancelLabel}</Button>
          <Button isDefault onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {message}
    </Dialog>
  );
}
