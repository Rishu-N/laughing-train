'use client';

/**
 * Rishu — the easter-egg mascot.
 *
 * OWNER: Mascot agent.
 *
 * In the spirit of Mr. Macintosh, the character Andy Hertzfeld wired a hook for
 * in 1982 and Apple never shipped: a tiny figure who appears unpredictably,
 * winks, and is gone before you're sure you saw him. The look is entirely our
 * own — see RishuSprite.tsx.
 *
 * The whole design is the *absence* of a trigger. Three low-probability rolls,
 * none of them reachable on purpose:
 *
 *   idle    — a tick that only rolls if you've touched nothing for a while
 *   click   — a long-odds roll on any pointer press
 *   return  — a roll when the tab comes back to the foreground
 *
 * behind a mount grace period, a cooldown and a per-session cap. Every number
 * lives in rishuOdds.ts with the expected frequency written out in English.
 * There is no imperative "appear now" export and no test id: if you can make
 * him show up on demand, the joke is dead.
 *
 * Mounted once by components/stage/Stage.tsx, above whichever shell is on
 * screen, so the joke carries across the update transition. Renders nothing —
 * not even the overlay — until a roll lands.
 */
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { LAYERS } from '@/lib/os/layers';
import RishuSprite, { type RishuFrame } from './RishuSprite';
import { pickAnchor, type RishuAnchor } from './rishuAnchors';
import {
  IDLE_AFTER_MS,
  IDLE_TICK_MS,
  rollAppearance,
  type RishuContext,
  TUNING,
} from './rishuOdds';

/* ── The whole visit, start to finish, is under 1.5s ───────────────────────── */

/** Fade/slide in. */
const ENTER_S = 0.22;
/** Fade/slide out. */
const EXIT_S = 0.26;
/** He stands for a beat before the wink, so the gesture reads as deliberate. */
const WINK_START_MS = 300;
/** ...and drops it again before he goes. */
const WINK_END_MS = 830;
/** Total on-screen time before the exit animation starts. */
const VISIBLE_MS = 1150;
/** Reduced-motion visits are a static wink and a soft fade, nothing else. */
const REDUCED_VISIBLE_MS = 850;
const REDUCED_FADE_S = 0.4;

/** Sprite pixel size, in CSS px. 16×20 grid → 48×60 on screen. */
const PIXEL = 3;

interface Visit {
  id: number;
  anchor: RishuAnchor;
}

export interface RishuProps {
  /** Which shell is currently on screen. Tune appearance odds per context. */
  context: RishuContext;
}

export default function Rishu({ context }: RishuProps) {
  const prefersReduced = useReducedMotion() === true;
  const [visit, setVisit] = useState<Visit | null>(null);
  const [frame, setFrame] = useState<RishuFrame>('stand');

  // All the trigger bookkeeping lives in one ref: the listeners below are
  // registered once and must not be torn down and rebuilt on every render.
  const stateRef = useRef({
    mountedAt: 0,
    lastActivityAt: 0,
    lastVisitAt: 0,
    visits: 0,
    busy: false,
    nextId: 1,
  });

  /* ── Activity tracking, so "idle" means something ───────────────────────── */
  useEffect(() => {
    const state = stateRef.current;
    const now = Date.now();
    state.mountedAt = now;
    state.lastActivityAt = now;

    const touch = () => {
      stateRef.current.lastActivityAt = Date.now();
    };
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;
    for (const event of events) {
      window.addEventListener(event, touch, { passive: true });
    }
    return () => {
      for (const event of events) window.removeEventListener(event, touch);
    };
  }, []);

  /* ── The three rolls ────────────────────────────────────────────────────── */
  useEffect(() => {
    const tuning = TUNING[context];

    const attempt = (chance: number) => {
      const state = stateRef.current;
      const now = Date.now();
      const won = rollAppearance(
        {
          now,
          mountedAt: state.mountedAt,
          lastVisitAt: state.lastVisitAt,
          visitsSoFar: state.visits,
          busy: state.busy,
        },
        tuning,
        chance,
      );
      if (!won) return;

      state.busy = true;
      state.lastVisitAt = now;
      state.visits += 1;
      const id = state.nextId;
      state.nextId += 1;
      // The opening frame is decided here, with the visit, rather than in an
      // effect — a reduced-motion visit is a single static wink, so it never
      // needs the stand → wink → stand cycle at all.
      setFrame(prefersReduced ? 'wink' : 'stand');
      setVisit({ id, anchor: pickAnchor(context) });
    };

    const onPointerDown = () => attempt(tuning.perClick);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') attempt(tuning.onTabReturn);
    };
    const tick = window.setInterval(() => {
      const idleFor = Date.now() - stateRef.current.lastActivityAt;
      if (idleFor < IDLE_AFTER_MS) return;
      if (document.visibilityState !== 'visible') return;
      attempt(tuning.idlePerTick);
    }, IDLE_TICK_MS);

    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(tick);
      window.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [context, prefersReduced]);

  /* ── One visit's choreography ───────────────────────────────────────────── */
  useEffect(() => {
    if (!visit) return;

    const end = () => {
      stateRef.current.busy = false;
      setVisit(null);
    };

    if (prefersReduced) {
      // No frame swapping, no travel — he is simply, briefly, there.
      const done = window.setTimeout(end, REDUCED_VISIBLE_MS);
      return () => window.clearTimeout(done);
    }

    const timers = [
      window.setTimeout(() => setFrame('wink'), WINK_START_MS),
      window.setTimeout(() => setFrame('stand'), WINK_END_MS),
      window.setTimeout(end, VISIBLE_MS),
    ];
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [visit, prefersReduced]);

  return (
    <AnimatePresence>
      {visit ? (
        <motion.div
          key={visit.id}
          aria-hidden="true"
          // pointer-events: none is non-negotiable — he is scenery, and the
          // overlay only exists at all while he is on screen.
          style={
            {
              position: 'fixed',
              pointerEvents: 'none',
              zIndex: LAYERS.boot,
              ...visit.anchor.style,
            } as CSSProperties
          }
          initial={
            prefersReduced
              ? { opacity: 0 }
              : { opacity: 0, x: visit.anchor.from.x, y: visit.anchor.from.y }
          }
          animate={
            prefersReduced
              ? { opacity: 1, transition: { duration: REDUCED_FADE_S, ease: 'linear' } }
              : { opacity: 1, x: 0, y: 0, transition: { duration: ENTER_S, ease: 'easeOut' } }
          }
          exit={
            prefersReduced
              ? { opacity: 0, transition: { duration: REDUCED_FADE_S, ease: 'linear' } }
              : {
                  opacity: 0,
                  x: visit.anchor.from.x,
                  y: visit.anchor.from.y,
                  transition: { duration: EXIT_S, ease: 'easeIn' },
                }
          }
        >
          <RishuSprite
            frame={frame}
            context={context}
            flip={visit.anchor.flip}
            pixel={PIXEL}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
