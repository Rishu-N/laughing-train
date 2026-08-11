/**
 * Every timer the classic front door runs on, in one place.
 *
 * OWNER: Classic Boot agent.
 *
 * The classic shell is on screen for EVERY visit with no skip, so it sits in
 * front of the portfolio on every single load. That makes these numbers a
 * product decision, not a detail: the update notification has to arrive in a
 * few seconds, and the whole handoff has to be over in about two more.
 *
 * The e2e suite waits up to 20s for `software-update-action` to appear on its
 * own — everything here has to stay comfortably inside that.
 */

export interface ClassicTiming {
  /** Startup plate (mark + "Welcome") before the desktop is revealed. */
  welcomeMs: number;
  /** Mount → the Software Update notification drops in. */
  noticeMs: number;
}

export function classicTiming(reducedMotion: boolean): ClassicTiming {
  // Reduced motion shortens the wait rather than removing the beat entirely —
  // the notification still has to arrive on its own.
  if (reducedMotion) return { welcomeMs: 250, noticeMs: 1000 };
  return { welcomeMs: 850, noticeMs: 2800 };
}

export interface TransitionTiming {
  /** The mark glitches and the install bar fills. */
  installMs: number;
  /** Dither dissolve that erases the mark. */
  dissolveMs: number;
  /** Inverse dither reveal that brings the wordmark in. */
  revealMs: number;
  /** Total run before finishUpdate() is expected. */
  totalMs: number;
  /** Backstop: fires even if the animation callback never lands. */
  safetyMs: number;
}

export function transitionTiming(reducedMotion: boolean): TransitionTiming {
  if (reducedMotion) {
    return { installMs: 320, dissolveMs: 120, revealMs: 180, totalMs: 700, safetyMs: 1600 };
  }
  // Kept tight on purpose: this plays on every visit, and the colour OS still
  // has its own ~2s boot to run once it lands.
  return { installMs: 760, dissolveMs: 440, revealMs: 500, totalMs: 1760, safetyMs: 3200 };
}

/** Dissolve starts once the install bar is full. */
export function dissolveStart(t: TransitionTiming): number {
  return t.installMs;
}

/** The wordmark reveal starts after the mark is fully gone. */
export function revealStart(t: TransitionTiming): number {
  return t.installMs + t.dissolveMs;
}
