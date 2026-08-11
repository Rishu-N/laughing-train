# CONTRACT-PHASE3.md — classic boot, software update, Rishu

Addendum to `CONTRACT.md`. **Read that first** — its hard rules, design tokens and
shared primitives still apply. This file covers only what Phase 3 adds.

Phase 3 **bolts a new front door in front of** the finished colour OS. It does not
rebuild it. Phase 1 and 2 are done, tested (46 e2e passing) and must stay that way.

---

## 1. ⚠️ Trademark rule — the one that gets the project in trouble

**Reproduce no Apple trademark or artwork anywhere in this project.** Not the bitten
apple, not the rainbow logo, not the Happy Mac smiling-computer icon, not Susan
Kare's original bitmaps. Style-inspired only: 1-bit chunky pixels, minimal industrial
design, the *spirit* of 1984 Macintosh UI.

The coordinator has already removed the two violations Phase 0 generated
(`happy-mac.svg`, and a rainbow-striped `logo.svg`) and replaced them with original
stand-ins — an unbranded floppy-disk boot mark and a blocky "R" monogram. The
Brand agent replaces those stand-ins with finished originals.

If you are unsure whether a shape is too close to Apple's, it is. Draw something else.

## 2. The stage machine

`app/page.tsx` renders `components/stage/Stage.tsx`, which mounts one shell at a time
from `lib/os/stageStore.ts` (**coordinator-owned, do not edit**):

```
classic ──beginUpdate()──▶ updating ──finishUpdate()──▶ color
   ▲                                                      │
   └──────────────── restart() (logo menu) ◀───────────────┘
```

```ts
import { useStageStore } from '@/lib/os/stageStore';
useStageStore.getState().beginUpdate();   // classic  → updating
useStageStore.getState().finishUpdate();  // updating → colour OS
```

- **The classic shell runs on every visit, with no skip.** Confirmed product
  decision. Consequence you must respect: keep it *short* before the update
  notification appears — it now sits in front of the portfolio on every load.
- `Restart…` in the colour OS logo menu is already wired and returns to `classic`.
- `Stage` keys the colour `Desktop` on a generation counter, so a restart replays its
  boot and re-opens the Browser correctly. You do not need to handle that.

## 3. Test-id contract (required — the e2e suite depends on these)

The existing 46-test suite now routes through the classic shell on every test via
`throughClassicShell()` in `tests/helpers.ts`. **If you rename or drop these, the
entire suite fails.**

| Test id | On | Meaning |
| --- | --- | --- |
| `classic-shell` | root of the classic shell | the 1984 screen is up |
| `software-update-action` | the control that accepts the update | must become visible on its own within ~20s of the shell mounting |
| `update-transition` | root of the transition | must **unmount** when the transition completes |

## 4. Ownership

| Agent | Owns exclusively |
| --- | --- |
| **Brand/Asset** | `public/images/brand/**`, `public/images/desktop/{logo,boot-mark}.svg`, `scripts/generate-brand.mjs` |
| **Classic Boot** | `components/classic/**`, `lib/classic/**` |
| **Mascot** | `components/mascot/**` |

Frozen for everyone: `lib/os/**`, `components/stage/**`, `components/os/**`,
`components/apps/**`, `content/**`, `app/globals.css`, `tests/helpers.ts`.

Same rules as Phase 1: no `npm install`, no `npm run build`/`dev`, no `git`, verify
with `npx tsc --noEmit` only. Two other agents are editing this tree concurrently, so
errors in files you don't own are expected and not yours to fix.

## 5. Visual language of the classic shell

This is **not** the System 7 look. Deliberately more primitive:

- **Pure 1-bit.** Black and white only — no grays, no colour, no anti-aliasing, no
  gradients, no shadows, no rounded corners. Dither for any "gray".
- Thin menu bar; chunky bitmap icons; a bitmap-style pixel font
  (`--font-os-ui`, i.e. Silkscreen, is already loaded and correct here).
- Minimal window chrome: title bar and close box, nothing else. **No dock, no
  resize grip, no zoom, no minimize** — those are later inventions.
- Do **not** import the System 7 primitives from `components/os/ui` — they are
  beveled and colour-aware. Build small 1-bit equivalents inside
  `components/classic/`. This is the one place the shared-primitive rule is
  deliberately suspended.

## 6. Desk accessories

Homage the ones that shipped with System 1.0 in 1984, reachable from the top-left
menu (use your own mark, not Apple's):

Alarm Clock · **Calculator (must actually work)** · Scrapbook · Note Pad · Key Caps ·
Control Panel · **Puzzle (must actually work — sliding-tile)**

The other five can be light, mostly-cosmetic homages. **No web browser on this
screen** — the web did not exist in 1984, and its absence is part of the joke.

## 7. Rishu

An original easter-egg mascot in the spirit of Mr. Macintosh — the character Steve
Jobs wanted in 1982, that Andy Hertzfeld wired a hook for and Apple never shipped.
Design your own look; do not attempt to recreate any historical artwork.

- **No reliable, discoverable trigger.** Low-probability checks only (a rare roll on
  opening a menu, an idle timer, an improbable click count). If a user can reproduce
  it on demand, it has failed.
- Appear → wink/gesture → vanish, inside a second or two.
- Rare in the classic shell, **rarer still** in the colour OS.
- Never blocks input, never covers what the user is working on, and must respect
  `prefers-reduced-motion`.
- Mounted once by `Stage` as `<Rishu context="classic" | "color" />`. Keep that
  signature.
