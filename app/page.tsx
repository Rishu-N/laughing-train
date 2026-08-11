import Desktop from '@/components/os/Desktop';

/**
 * The entire site is one route. Everything else is a window.
 *
 * Desktop is a Client Component — the whole OS (window manager, drag, canvas,
 * localStorage) is client-side. Only /api/terminal runs on the server.
 */
export default function Home() {
  return <Desktop />;
}
