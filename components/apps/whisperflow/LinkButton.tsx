'use client';

/**
 * An anchor wearing a System 7 push button.
 *
 * `Button` in the shared barrel renders a <button>, which is right for actions
 * and wrong for navigation: the download link needs middle-click, "copy link
 * address" and the browser's own status bar to keep working.
 */
import type { ReactNode } from 'react';

export function LinkButton({
  href,
  children,
  emphasis = false,
}: {
  href: string;
  children: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`os-button os-chrome-text inline-block no-underline text-os-ink ${
        emphasis ? 'os-button-default' : ''
      }`}
    >
      {children}
    </a>
  );
}
