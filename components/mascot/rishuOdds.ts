/**
 * Rishu's odds — every number that decides whether the ghost shows up.
 *
 * OWNER: Mascot agent.
 *
 * Split out from the component on purpose: the appearance rule is a pure
 * function of numbers here, so it can be reasoned about (and unit-tested in
 * isolation) without giving anything in the DOM a way to *make* Rishu appear.
 * There is deliberately no imperative "show now" escape hatch anywhere.
 *
 * ── How often does he actually turn up? ──────────────────────────────────────
 * Three independent, low-probability rolls, all gated by a mount grace period,
 * a cooldown and a per-session cap:
 *
 *   1. IDLE   — every IDLE_TICK_MS, *if* the user has touched nothing for at
 *               least IDLE_AFTER_MS, roll `idlePerTick`.
 *   2. CLICK  — every pointer press anywhere, roll `perClick`.
 *   3. RETURN — when the tab becomes visible again, roll `onTabReturn`.
 *
 * In plain English, with the values below:
 *
 *   CLASSIC SHELL  ~1 in 16 idle ticks → roughly once per 2½ minutes of
 *                  *uninterrupted staring*, and about once per 150 clicks.
 *                  Realistically: a handful of visits before you see him once.
 *   COLOUR OS      ~4–5× rarer again — roughly once per 15 minutes of idling,
 *                  once per 700 clicks. Most sessions will never see him.
 *
 * Turn the four numbers per context below and nothing else needs to change.
 */

export type RishuContext = 'classic' | 'color';

export interface RishuTuning {
  /** Chance per idle tick (one tick every IDLE_TICK_MS of continuous idling). */
  idlePerTick: number;
  /** Chance per pointer press anywhere on the page. */
  perClick: number;
  /** Chance when the tab regains visibility. */
  onTabReturn: number;
  /** Minimum quiet time between two appearances, ms. */
  cooldownMs: number;
  /** Hard cap for the whole page session, both shells combined. */
  maxPerSession: number;
}

/**
 * Nothing at all may happen for this long after mount. Rishu is mounted once,
 * for the life of the page, so this is a session-wide grace period — without it
 * an early appearance reads as a loading animation rather than a haunting.
 */
export const MOUNT_GRACE_MS = 14_000;

/** How often the idle roll is even considered. */
export const IDLE_TICK_MS = 9_000;

/** How long the user must have touched nothing before an idle roll counts. */
export const IDLE_AFTER_MS = 7_000;

export const TUNING: Record<RishuContext, RishuTuning> = {
  // Rare. The 1984 shell is short-lived, so the odds per roll are the higher
  // of the two — but it is still a coin you lose most of the time.
  classic: {
    idlePerTick: 1 / 16,
    perClick: 1 / 150,
    onTabReturn: 1 / 10,
    cooldownMs: 75_000,
    maxPerSession: 3,
  },
  // Rarer still. This is the shell people actually spend time in, and a mascot
  // you meet twice in five minutes stops being a rumour.
  color: {
    idlePerTick: 1 / 100,
    perClick: 1 / 700,
    onTabReturn: 1 / 40,
    cooldownMs: 240_000,
    maxPerSession: 2,
  },
};

/** Everything the decision depends on, as plain numbers. */
export interface RishuMoment {
  /** Current timestamp, ms. */
  now: number;
  /** When the component mounted, ms. */
  mountedAt: number;
  /** When the last appearance started, ms. 0 if there has not been one. */
  lastVisitAt: number;
  /** Appearances so far this page session. */
  visitsSoFar: number;
  /** True while an appearance is on screen. */
  busy: boolean;
}

/**
 * The gate: is Rishu even *allowed* to consider showing up right now? Pure, and
 * intentionally boring — all the mystery lives in the roll, not in here.
 */
export function canAppear(moment: RishuMoment, tuning: RishuTuning): boolean {
  if (moment.busy) return false;
  if (moment.visitsSoFar >= tuning.maxPerSession) return false;
  if (moment.now - moment.mountedAt < MOUNT_GRACE_MS) return false;
  if (moment.lastVisitAt !== 0 && moment.now - moment.lastVisitAt < tuning.cooldownMs) {
    return false;
  }
  return true;
}

/**
 * The gate plus the dice. `rng` is injectable so the behaviour can be reasoned
 * about deterministically in a test *of this function* — never from the DOM.
 */
export function rollAppearance(
  moment: RishuMoment,
  tuning: RishuTuning,
  chance: number,
  rng: () => number = Math.random,
): boolean {
  if (!canAppear(moment, tuning)) return false;
  return rng() < chance;
}
