import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

/*
 * Fonts are SELF-HOSTED from app/fonts, not fetched from Google.
 *
 * next/font/google downloads at build time, so `npm run dev` hard-fails with no
 * internet — which would make the whole project unusable on a plane. Vendoring
 * the woff2 files (14 KB total, OFL licensed — see app/fonts/README.md) is what
 * makes this run completely offline.
 *
 * If you swap in a different pixel font, drop the woff2 in app/fonts and change
 * the paths here. Don't reach for next/font/google — that reintroduces the
 * network dependency.
 */

// Chrome font: title bars, menus, buttons. Pixel fonts only read well small.
const silkscreen = localFont({
  src: [
    { path: './fonts/silkscreen-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/silkscreen-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-silkscreen',
  display: 'swap',
  // Rendered at 9–11px, so a mismatched fallback would reflow noticeably.
  fallback: ['Chicago', 'Geneva', 'monospace'],
});

// Terminal font.
const vt323 = localFont({
  src: [{ path: './fonts/vt323-400.woff2', weight: '400', style: 'normal' }],
  variable: '--font-vt323',
  display: 'swap',
  fallback: ['Monaco', 'Menlo', 'monospace'],
});

export const metadata: Metadata = {
  title: 'Macintosh — Portfolio',
  description: 'A personal portfolio that boots like a 90s Macintosh.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // The desktop metaphor breaks if the user can pinch-zoom the chrome away.
  maximumScale: 1,
  themeColor: '#6a8ca8',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${silkscreen.variable} ${vt323.variable}`}>
      <body>{children}</body>
    </html>
  );
}
