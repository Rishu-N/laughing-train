'use client';

/**
 * Form controls in OS chrome.
 *
 * SHARED PRIMITIVE — read-only for Phase 1 agents.
 */
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';

/** Sunken single-line text input. */
export function TextField({
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`os-inset min-w-0 rounded-[2px] px-1.5 py-1 font-[family-name:var(--font-os-body)] text-[12px] outline-none focus:ring-1 focus:ring-os-accent ${className}`}
      {...rest}
    />
  );
}

/** Dropdown styled to match the chrome. */
export function Select({
  className = '',
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`os-bevel rounded-[3px] px-1.5 py-[3px] os-chrome-text text-[11px] outline-none focus:ring-1 focus:ring-os-accent ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={`flex cursor-default items-center gap-1.5 os-chrome-text text-[11px] ${className}`}>
      <input type="checkbox" className="accent-os-accent" {...rest} />
      {label}
    </label>
  );
}

export function Radio({
  label,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={`flex cursor-default items-center gap-1.5 os-chrome-text text-[11px] ${className}`}>
      <input type="radio" className="accent-os-accent" {...rest} />
      {label}
    </label>
  );
}

/** Label + control row, for settings strips and dialogs. */
export function Field({
  label,
  children,
  className = '',
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex items-center gap-2 ${className}`}>
      <span className="shrink-0 os-chrome-text text-[11px]">{label}</span>
      {children}
    </label>
  );
}

/** Boxed group with a title, like a System 7 preferences panel. */
export function FieldGroup({
  title,
  children,
  className = '',
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={`rounded-[3px] border border-os-chrome-dark p-2 ${className}`}>
      {title && (
        <legend className="px-1 os-chrome-text text-[10px] text-os-ink-soft">{title}</legend>
      )}
      {children}
    </fieldset>
  );
}
