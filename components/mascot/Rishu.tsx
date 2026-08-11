'use client';

/**
 * Rishu — the easter-egg mascot.
 *
 * OWNER: Mascot agent. Phase 3 stub: renders nothing.
 *
 * In the spirit of Mr. Macintosh, the character Andy Hertzfeld wired a hook for
 * in 1982 and Apple never shipped: a tiny figure who appears unpredictably,
 * winks, and is gone before you're sure you saw him.
 *
 * Design rules that matter more than the animation:
 *   - No reliable, discoverable trigger. Low-probability checks only.
 *   - Appear → gesture/wink → vanish inside a second or two.
 *   - Rare in the classic shell, RARER in the colour OS.
 *   - Never blocks input; never lands on top of something the user is using.
 *
 * Mounted once by components/stage/Stage.tsx, above whichever shell is on
 * screen, so the joke carries across the update transition.
 */

export interface RishuProps {
  /** Which shell is currently on screen. Tune appearance odds per context. */
  context: 'classic' | 'color';
}

export default function Rishu(_props: RishuProps) {
  return null;
}
