'use client';

/**
 * CRT dressing for the terminal: scanlines, phosphor glow, a soft mains
 * flicker and the blinking block cursor.
 *
 * This lives in a <style> tag rather than globals.css because app/globals.css
 * is coordinator-owned and frozen. Everything is namespaced `tm-` so it cannot
 * collide with another app's styles.
 *
 * All keyframes END on their fully-visible frame. globals.css neutralises
 * animations under `prefers-reduced-motion` by forcing one 0.01ms iteration,
 * so ending opaque is what keeps the cursor and the screen visible for users
 * who have motion turned off.
 *
 * OWNER: Terminal agent.
 */

const CSS = `
.tm-screen {
  position: relative;
  overflow: hidden;
}

/* Phosphor bloom. Dropped entirely when CRT effects are off, because the
   glow is the part people find hardest to read. */
.tm-crt .tm-text {
  text-shadow:
    0 0 4px color-mix(in srgb, var(--color-os-phosphor) 55%, transparent),
    0 0 12px color-mix(in srgb, var(--color-os-phosphor) 22%, transparent);
}

.tm-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.tm-scanlines {
  background-image: repeating-linear-gradient(
    to bottom,
    rgb(0 0 0 / 0.3) 0px,
    rgb(0 0 0 / 0.3) 1px,
    transparent 1px,
    transparent 3px
  );
}

.tm-bloom {
  background: radial-gradient(
    ellipse at 50% 45%,
    color-mix(in srgb, var(--color-os-phosphor) 7%, transparent),
    transparent 70%
  );
  animation: tm-flicker 5s steps(1, end) infinite;
}

@keyframes tm-flicker {
  0%   { opacity: 0.86; }
  4%   { opacity: 1; }
  46%  { opacity: 0.92; }
  49%  { opacity: 1; }
  92%  { opacity: 0.9; }
  100% { opacity: 1; }
}

.tm-cursor {
  display: inline-block;
  width: 0.55em;
  height: 1em;
  vertical-align: -0.14em;
  background-color: var(--color-os-phosphor);
  animation: tm-blink 1.05s steps(1, end) infinite;
}

@keyframes tm-blink {
  0%   { opacity: 0; }
  50%  { opacity: 1; }
  100% { opacity: 1; }
}
`;

export function CrtStyles() {
  return <style>{CSS}</style>;
}
