import Stage from '@/components/stage/Stage';

/**
 * The entire site is one route. Everything else is a window.
 *
 * Stage is a Client Component owning the classic → updating → colour handoff;
 * the whole OS (window manager, drag, canvas, localStorage) is client-side.
 * Only /api/terminal runs on the server.
 */
export default function Home() {
  return <Stage />;
}
