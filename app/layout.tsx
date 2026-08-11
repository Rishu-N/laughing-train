import type { Metadata, Viewport } from 'next';
import { Silkscreen, VT323 } from 'next/font/google';
import './globals.css';

// Chrome font: title bars, menus, buttons. Pixel fonts only read well small.
const silkscreen = Silkscreen({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-silkscreen',
  display: 'swap',
});

// Terminal font.
const vt323 = VT323({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-vt323',
  display: 'swap',
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
