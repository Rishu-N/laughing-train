'use client';

/**
 * System 7 push buttons.
 *
 * SHARED PRIMITIVE — read-only for Phase 1 agents. Import, don't reimplement.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type BaseProps = ButtonHTMLAttributes<HTMLButtonElement>;

export interface ButtonProps extends BaseProps {
  /** Draws the heavy System 7 default-button ring. One per dialog. */
  isDefault?: boolean;
  children?: ReactNode;
}

export function Button({
  isDefault = false,
  className = '',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={[
        'os-button os-chrome-text',
        isDefault ? 'os-button-default' : '',
        disabled
          ? 'text-os-disabled'
          : 'active:os-bevel-in active:translate-y-px hover:brightness-[0.98]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
}

export interface IconButtonProps extends BaseProps {
  /** Required — icon-only controls are invisible to screen readers without it. */
  label: string;
  /** Renders in the pressed state (e.g. the selected Paint tool). */
  active?: boolean;
  children?: ReactNode;
}

/**
 * Square icon control for tool palettes and browser chrome. `label` becomes both
 * the tooltip and the accessible name.
 */
export function IconButton({
  label,
  active = false,
  className = '',
  disabled,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className={[
        'flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[3px] os-chrome-text text-[12px] leading-none',
        active ? 'os-bevel-in' : 'os-bevel',
        disabled ? 'text-os-disabled' : 'active:os-bevel-in',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
}
