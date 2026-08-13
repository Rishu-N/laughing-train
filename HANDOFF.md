# HANDOFF.md — full context transfer

You are picking up a finished, working project. This file carries everything
that **isn't visible in the code**: what was decided and why, what is
deliberately the way it is, and the traps that cost real time to find.

**Read this first, then `CONTRACT.md`.** `README.md` covers how to run it.

| | |
| --- | --- |
| Repo | `Rishu-N/laughing-train` |
| Branch | `claude/90s-os-portfolio-174tcv` (**not** `main`) |
| Owner | Rishu N — `rishunandaarav2003@gmail.com` |
| State | Everything committed and pushed; working tree clean |
| PR | None opened — never requested |

---

## Table of contents

1. [What this is](#1-what-this-is)
2. [Verified state](#2-verified-state)
3. [Quick start for a new agent](#3-quick-start-for-a-new-agent)
4. [Rules you must not break](#4-rules-you-must-not-break)
5. [Architecture](#5-architecture)
6. [Complete file map](#6-complete-file-map)
7. [API reference](#7-api-reference)
8. [The content system](#8-the-content-system)
9. [Design system](#9-design-system)
10. [App inventory](#10-app-inventory)
11. [The classic 1984 shell](#11-the-classic-1984-shell)
12. [Rishu, the mascot](#12-rishu-the-mascot)
13. [The terminal and its offline brain](#13-the-terminal-and-its-offline-brain)
14. [Offline guarantee](#14-offline-guarantee)
15. [Tests](#15-tests)
16. [Traps — don't rediscover these](#16-traps--dont-rediscover-these)
17. [Settled product decisions](#17-settled-product-decisions)
18. [Known gaps](#18-known-gaps)
19. [How this was built (multi-agent)](#19-how-this-was-built-multi-agent)
20. [Debugging playbook](#20-debugging-playbook)
21. [Deployment](#21-deployment)
22. [Suggested next steps](#22-suggested-next-steps)
23. [Glossary](#23-glossary)

---

## 1. What this is

A personal portfolio that presents itself as a Macintosh operating system.
You don't scroll it — you boot it.

**The flow, in order:**

1. Every visit lands in a **1984 black-and-white machine**. Thin menu bar, 1-bit
   UI, chunky icons, seven desk accessories in the top-left menu (Calculator and
   the sliding Puzzle genuinely work).
2. At **2.8 seconds** a **"Software Update Available"** notice drops in from the
   top-left.
3. Clicking **Install** plays a **1.76s** transition: the monochrome mark
   glitches, dissolves through an ordered dither, and the "Rishu Inc" wordmark
   resolves out of the same dither on the far side.
4. You land in a **System 7 colour desktop**, with a 1996-era web browser already
   open on the owner's bio. Everything else — paint program, word processor,
   spreadsheet, terminal, one app per project, three games — is an app you open,
   drag, collapse into the dock, and close.
5. **`Restart…`** in the logo menu (top right) returns to 1984.

A mascot called **Rishu** appears rarely in both shells and **cannot be
summoned**. That's the joke.

All content is **placeholder**. The owner will replace it, and **other agents may
be asked to populate `content/projects.ts` programmatically** — which is why §4.2
matters so much.

---

## 2. Verified state

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | clean |
| `npx eslint .` | clean |
| `npm run build` | clean — `/` static, `/api/terminal` dynamic |
| `npm run test:e2e` | **56 passed, 0 failed, 14 skipped** |
| Security | no key material, no Anthropic SDK in `.next/static` |
| Offline | builds **and** runs with all outbound network blocked |
| Fresh clone | `./setup.sh` → `npm run dev` → serves 200 |

**The 14 skips are by design** — desktop-only specs skip on the mobile Playwright
project and vice versa. Do not "fix" them.

**Stack:** Next.js 16.3.0 (App Router, Turbopack) · React 19.2.8 · TypeScript ·
Tailwind **v4** (CSS-first `@theme`, no JS config) · Zustand 5 · Framer Motion 13
· `@anthropic-ai/sdk` 0.116 · Playwright 1.62. Node **≥ 20.9** required.

**Registered app ids (14):**
`about` `browser` `factsweeper` `g2048` `notes` `paint` `snake` `spreadsheet`
`terminal` `word` + generated project apps `cli-tool` `data-pipeline`
`scraper-bot` `ui-playground`.

---

## 3. Quick start for a new agent

```bash
./setup.sh          # idempotent: checks Node, installs, configures, typechecks
npm run dev         # http://localhost:3000
```

Then, before changing anything:

```bash
npm run typecheck && npm run lint && npm run build
npm run test:e2e    # expect 56 passed / 0 failed / 14 skipped
```

If that baseline isn't green, **stop and find out why before writing code** —
it was green at handoff.

**Orientation reading order:** this file → `CONTRACT.md` (§4 registering an app,
§6 content rules, §8 design system) → `lib/os/types.ts` → `lib/os/registry.ts` →
`components/stage/Stage.tsx`.

---

## 4. Rules you must not break

Load-bearing. Breaking any is a regression even if tests still pass.

### 4.1 No Apple trademarks, anywhere

The owner asked for this explicitly and in writing. **No bitten apple, no
rainbow logo, no Happy Mac smiling-computer icon, no recreations of Susan Kare's
original bitmaps.** Style-inspired only — 1-bit pixels, chunky letterforms and
50% dither are a *medium*, not a mark.

Phase 0 originally generated a literal Happy Mac (`happy-mac.svg`) and a
rainbow-striped `logo.svg`. **Both were deleted** and replaced with originals:

| Asset | What it is now |
| --- | --- |
| `brand/classic-mark.svg` | An abstract four-point spark in a double-ruled plate |
| `brand/rishu-inc.svg` | "RISHU" in pixel caps + "INC" reversed out of a slug |
| `brand/classic-portrait.png` | A generic 1-bit human bust, 32×32 |
| `desktop/logo.svg` | An `R` monogram, drawn at 16×16 for its real render size |
| `desktop/boot-mark.svg` | The same `R` at 2× with a hard offset shadow |

`SYSTEM_IMAGES.happyMac` **no longer exists** — the slot is `bootMark`.

If you regenerate art, keep it original. If a shape feels close to Apple's, it
is. Draw something else.

### 4.2 Content lives in `content/`, never in components

The owner edits `content/`, and **a future agent may populate
`content/projects.ts` programmatically**. That only works if no component embeds
content.

**Wrong:** `<h1>Rishu N</h1>`
**Right:** `<h1>{bio.name}</h1>`

UI chrome labels ("New", "Cancel", "Back", column headers) legitimately live in
components. Biographical, project and fact *content* does not. A QA pass greps
for this.

### 4.3 It must keep running fully offline

After `npm install`, **nothing makes a network request**.
`tests/offline.spec.ts` asserts the page makes **zero cross-origin requests**.
In particular: **never reintroduce `next/font/google`** — see §16.1.

### 4.4 Window layout is deliberately not persisted

Documents persist (`useAppSession`); the desk does not. Every load is a cold
boot, which is what guarantees the Browser is the first thing a visitor sees.
Adding layout persistence breaks a stated requirement.

### 4.5 Frozen files

Do not edit without a very good reason: `lib/os/types.ts`, `lib/os/layers.ts`,
`lib/os/persist.ts`, `lib/os/registry.ts`, `lib/os/stageStore.ts`,
`content/types.ts`, `content/images.ts`, `app/globals.css`,
`components/os/ui/**`, `components/stage/**`.

---

## 5. Architecture

### 5.1 One route, two shells

`app/page.tsx` renders `<Stage />`. `lib/os/stageStore.ts` holds the machine:

```
classic ──beginUpdate()──▶ updating ──finishUpdate()──▶ color
   ▲                                                     │
   └──────────── restart() (logo menu) ◀──────────────────┘
```

`Stage` mounts exactly one shell at a time inside `AnimatePresence`, and hoists
`<Rishu />` above whichever is showing so the mascot survives the transition.

**`Stage` keys the colour `Desktop` on a generation counter.** This is why
`Restart…` genuinely replays the boot and re-opens the Browser instead of
silently reusing the previous mount's window state.

### 5.2 The classic shell is its own small world

It deliberately **does not** reuse the System 7 window manager or
`components/os/ui` primitives. 1-bit windows have no bevel, no dock, no resize
and no zoom; threading a `variant` flag through chrome that shares almost
nothing would cost more than it saves. `components/classic/ui/` has its own
tiny `Bit*` primitives. **This is the one place the shared-primitive rule is
intentionally suspended.**

### 5.3 Registry of manifests

`lib/os/registry.ts` is the union of seven `lib/apps/*.apps.ts` manifests. This
indirection exists because **seven agents built this in parallel in one working
tree** — each owned exactly one manifest, so nobody ever edited a shared
registry file.

Keep it. It also means **nothing has a hardcoded app list**: the Apps menu, the
dock, the desktop icons, the boot screen's extension row, and the terminal's
`ls` / `open` / tab-completion all read the registry.

### 5.4 Minimized windows stay MOUNTED

Marked `inert` with `pointer-events: none`, **not** unmounted. That's what lets
the genie-lite minimize animation run and preserves app state across a collapse.

**Consequence: you cannot assert "minimized" by absence from the DOM.** Test the
dock tile state and the `inert` attribute instead.

### 5.5 One project component, N apps

`lib/apps/projects.apps.ts` maps over `content/projects.ts` and generates one
`AppDefinition` per entry, all pointing at a single `ProjectApp`. Adding a
project is **one array entry** — no new component, no new file, no registry edit.

---

## 6. Complete file map

```
app/
  page.tsx                    renders <Stage />
  layout.tsx                  fonts (LOCAL, not Google) + metadata
  globals.css                 design tokens (@theme) + chrome utilities — FROZEN
  api/terminal/route.ts       THE ONLY SERVER-SIDE CODE
  fonts/                      vendored woff2 + OFL licence — see §14
components/
  stage/Stage.tsx             the classic → updating → colour machine — FROZEN
  classic/
    ClassicShell.tsx          the 1984 desktop (front door)
    UpdateNotification.tsx    the "Software Update Available" banner
    UpdateTransition.tsx      the dither dissolve → colour OS
    ClassicDesktop.tsx        icons on the 1-bit desktop
    ClassicContext.tsx        shell services (open/close/alert/pattern)
    MenuBarExtras.tsx         clock + blinking update flag
    BrandMarks.tsx            ClassicMark / RishuIncWordmark, with fallbacks
    icons.ts                  hand-written 16×16 pixel maps
    ui/                       Bit, BitWindow, BitDialog, BitMenuBar, PixelIcon
    accessories/              the seven desk accessories + About + Disk
  mascot/
    Rishu.tsx                 trigger logic + choreography
    RishuSprite.tsx           original 16×20 sprite, two frames
    rishuOdds.ts              every tunable number + pure rollAppearance()
    rishuAnchors.ts           the six edge/corner placements
  os/
    Desktop.tsx               colour desktop root
    Window.tsx                System 7 frame: drag, resize, genie minimize
    MenuBar.tsx               Apps menu + logo dropdown + Restart…
    Dock.tsx                  running windows, right edge (bottom on mobile)
    BootSequence.tsx          colour-OS boot (~2s)
    AboutBox.tsx              "About This Macintosh"
    dockGeometry.ts           tile metrics shared with Window's minimize
    useIsMobile.ts            useIsMobile() / useViewport()
    ui/                       SHARED PRIMITIVES — FROZEN
  apps/
    browser/                  BrowserApp, site (pages), retro (90s web styling)
    paint/                    PaintApp, canvasOps, patterns, icons
    notes/ word/ spreadsheet/ the document apps
    terminal/                 TerminalApp, crt
    project/ProjectApp.tsx    ONE component, N apps
    games/factsweeper/        engine, factPool, Board, Dossier, App
    games/snake/ games/g2048/ arcade
lib/
  os/types.ts                 AppDefinition, AppWindowProps — FROZEN
  os/layers.ts                z-index layers + metrics — FROZEN
  os/registry.ts              union of manifests — FROZEN
  os/persist.ts               useAppSession — FROZEN
  os/stageStore.ts            stage machine — FROZEN
  os/windowStore.ts           the window manager (Zustand)
  apps/*.apps.ts              seven manifests, one per original agent
  classic/                    patterns, calculator, puzzle, timing, metrics,
                              media, clock — pure logic, no JSX
  terminal/                   commands (local parser), client, types,
                              offlineAnswers (the local brain)
content/                      EVERYTHING USER-EDITABLE — see §8
public/images/                generated art: icons, brand, portrait, projects
scripts/
  generate-placeholders.mjs   icons, portrait, screenshots, wallpaper
  generate-brand.mjs          the brand marks (DISJOINT files — see §16.5)
tests/                        9 spec files + helpers.ts
setup.sh                      one-shot laptop setup
CONTRACT.md                   the brief Phase 1 agents built against
CONTRACT-PHASE3.md            the brief Phase 3 agents built against
TASKS.md                      checklist + known gaps
```

---

## 7. API reference

### 7.1 `lib/os/windowStore.ts` — the window manager

```ts
import { useWindowStore } from '@/lib/os/windowStore';

const openApp = useWindowStore((s) => s.openApp);   // in a component
useWindowStore.getState().openApp('paint');          // outside React
```

| Method | Notes |
| --- | --- |
| `openApp(id, opts?)` | Returns `instanceId` or `null`. Singletons refocus instead of duplicating. Clamps opening geometry to the real work area |
| `closeWindow(id)` | |
| `minimizeWindow(id)` / `restoreWindow(id)` / `toggleMinimize(id)` | |
| `toggleMaximize(id, viewport?)` | Mobile-aware |
| `focusWindow(id)` | Skips the `set()` if already on top — avoids a re-render storm during drag |
| `moveWindow(id, x, y)` / `resizeWindow(id, w, h)` | |
| `setTitle(id, title)` | Apps rename their own title bar |
| `closeAll()` | Also resets the cascade index |
| `defocusAll()` | What clicking bare desktop does |
| `clampToViewport(viewport?)` | Called on resize so a window can't be stranded off-screen |

**Never set a z-index in a component.** Windows start at `LAYERS.windowBase`
(100) and take the next value on focus; the store renormalises past
`windowCeiling` (8000). Reserved layers live in `lib/os/layers.ts`:
`dock` 9000, `menuBar` 9500, `menuPopover` 9600, `boot` 9900.

Other constants there: `MOBILE_BREAKPOINT` 768, `MENUBAR_HEIGHT` 24,
`DOCK_WIDTH` 76, `DOCK_HEIGHT_MOBILE` 64.

### 7.2 `lib/os/stageStore.ts`

```ts
useStageStore.getState().beginUpdate();   // classic  → updating
useStageStore.getState().finishUpdate();  // updating → colour OS
useStageStore.getState().restart();       // colour OS → classic
```
Also exposes `stage` and `generation`.

### 7.3 `lib/os/persist.ts` — session persistence

```ts
const [doc, setDoc, reset, hydrated] = useAppSession('notes', { text: '' });
```

Namespaced `os90:v1:<appId>`, debounced 250 ms, SSR-safe, flushes on unmount and
on tab-hide. Also exports `loadSession` / `saveSession` / `clearSession` for
non-React use. **Never hand-roll localStorage.**

Used by: Notes, Word, Spreadsheet (all with an explicit **New** behind a
`ConfirmDialog`), Paint's canvas, Fact-sweeper's dossier, Snake and 2048 high
scores.

### 7.4 `lib/os/types.ts` — the app contract

```ts
interface AppDefinition {
  id: string;                    // kebab-case, unique; what `open <id>` uses
  title: string;
  icon: string;                  // from content/images.ts
  category: 'system' | 'creative' | 'project' | 'game';
  component: ComponentType<AppWindowProps>;   // next/dynamic, ssr: false
  defaultSize: { width: number; height: number };
  minSize?: { width: number; height: number };
  defaultPosition?: { x: number; y: number };  // omit to cascade
  resizable?: boolean;    // default true
  singleton?: boolean;    // default true
  showOnDesktop?: boolean;
  description?: string;   // shown by terminal `ls` and dock tooltip
  params?: Record<string, string>;
}

interface AppWindowProps {
  instanceId: string;
  appId: string;
  params?: Record<string, string>;
  setTitle: (t: string) => void;
  close: () => void;
}
```

Apps render **inside** an existing frame — no title bar, border or shadow of
their own. Fill `h-full w-full`, or use `<AppFrame>`.

### 7.5 Registry helpers

`allApps()` · `getApp(id)` · `appsByCategory(cat)` · `desktopApps()` ·
`appIds()` · `DEFAULT_APP_ID` (= `'browser'`, opened on boot).

---

## 8. The content system

```
content/types.ts     FROZEN schemas: Bio, Project, Fact, TerminalPersona
content/bio.ts       name, tagline, location, status, about[], skills[],
                     socials[], email, nowPlaying[]
content/projects.ts  Project[] — 4 placeholders. ONE ENTRY = ONE APP
content/facts.ts     Fact[] — 51 placeholders for Fact-sweeper
content/terminal.ts  banner[], systemPrompt, offlineReplies[]
content/images.ts    FROZEN path constants
content/README.md    field-by-field editing guide for the owner
```

**`Project`** — `id` (becomes the app id **and** the `open <id>` command, so keep
it short and typeable), `title`, `blurb`, `description[]`, `language` (drives the
icon via `iconForLanguage`), `tech[]`, `links[]`, `screenshot`, `year`, `status?`.

**`Fact`** — `id` (**permanent**: it's the localStorage key for "already
recovered", so renaming loses it from returning visitors' dossiers; rewriting
`label`/`value` is free), `label`, `value` (one line), `category`
(`basics`/`work`/`interests`/`trivia`/`opinions`), `rarity`.

**Rarity is the game mechanic**: `common` appears on any board, `uncommon` on
Medium and Hard, `rare` on Hard only. Current split: 22 / 19 / 10 — so Easy can
draw 22, Medium 41, Hard all 51. That's the reason to play the 16×30.

**Image slots** (`content/images.ts`): `SYSTEM_IMAGES` (`logo`, `bootMark`,
`desktopPattern`), `BRAND_IMAGES` (`classicMark`, `rishuInc`,
`classicPortrait`), `APP_ICONS`, `SELF_PORTRAIT`, `PROJECT_SCREENSHOTS` +
`projectScreenshot(n)`, `iconForLanguage(language)`.

To swap an image: **drop your file in with the same filename**. Only edit
`content/images.ts` if you want a different filename.

---

## 9. Design system

System 7 with colour accents. Not Windows 95, not Mac OS 8 platinum.

**Tailwind v4 — there is no `tailwind.config.js`.** Tokens are `@theme` in
`app/globals.css` and become utilities automatically (`--color-os-face` →
`bg-os-face` / `text-os-face` / `border-os-face`).

**Colour tokens:** `desktop` `desktop-alt` `face` `chrome` `chrome-dim`
`chrome-dark` `well` `ink` `ink-soft` `disabled` `accent` `accent-soft` `alert`
`warn` `ok` `phosphor` `phosphor-dim` `icon-python` `icon-web` `icon-game`.

**Font tokens:** `--font-os-ui` (Silkscreen — chrome, 9–11px only, unreadable
larger) · `--font-os-body` (system Geneva/Verdana stack — all body copy) ·
`--font-os-mono` (VT323 — terminal).

**Utility classes:** `os-window` `os-pinstripe` `os-bevel` `os-bevel-in`
(pressed) `os-inset` (sunken) `os-button` `os-button-default` `pixelated`
`os-scroll` `os-chrome-text`.

**Shared primitives** — import, never reimplement:

```ts
import {
  Button, IconButton,
  Dialog, ConfirmDialog,
  Toolbar, ToolbarSeparator, ToolbarSpacer, ToolbarLabel, StatusBar,
  TextField, Select, Checkbox, Radio, Field, FieldGroup,
  MenuList, MenuItem, MenuSeparator, MenuHeading,
  AppFrame, AppSidebar,
} from '@/components/os/ui';
```

`AppFrame` is `relative`, so a `Dialog` inside it dims only that app, not the
desktop.

**Responsive:** below 768px windows fill the screen, drag/resize turn off, the
dock becomes a bottom bar. Every app must be usable at **375px**, and the page
body must never scroll horizontally.

---

## 10. App inventory

| App | id | Notes |
| --- | --- | --- |
| **Browser** | `browser` | **Opens on boot.** Real history stack across Home/About/Skills/Links/Contact, working back/forward with forward-truncation, editable location bar, ~300ms fake load. The page *inside* deliberately uses Times serif + Netscape link colours instead of OS tokens — the contrast between 1996 web and System 7 chrome is the joke. Uses **container queries**, so it reflows against the *window* width, not the viewport |
| **Paint** | `paint` | 11 tools (pencil, brush, eraser, line, rect, oval, bucket, text, marquee), 17 swatches inc. 8 one-bit dither tiles, 24-step undo + Cmd/Ctrl+Z, PNG export. Preloads the pixel portrait at a whole-number scale. Pointer mapping via `getBoundingClientRect` against a fixed backing store — one scale factor, no DPR maths. Canvas persists as a data URL, halving resolution past a 600 KB budget |
| **Notes** | `notes` | Plain text, line-number gutter, counts in the status bar, title tracks the first line |
| **Word** | `word` | B/I/U with live state from the selection, alignment, font/size, page-on-grey layout. `execCommand` isolated behind `richText.ts` with its rationale. **No `dangerouslySetInnerHTML` anywhere** — HTML is reapplied imperatively |
| **Spreadsheet** | `spreadsheet` | 26×50, formula bar, full keyboard nav. Hand-written tokenizer + recursive-descent evaluator — **no `eval`, no `new Function`**. `SUM AVG AVERAGE MIN MAX COUNT ABS ROUND`, ranges, precedence, `$A$1`, `%`, `&`. Errors: `#ERROR` `#DIV/0!` `#NAME?` `#REF!` and **`#CIRC!`** via a `visiting` set for self- and mutual cycles (getting this wrong hangs the tab). Ranges capped at 20k cells |
| **Terminal** | `terminal` | See §13 |
| **Fact-sweeper** | `factsweeper` | Minesweeper where safe cells reveal facts into a persistent **Dossier**. First click always safe (mines seed *after* it, protecting the 3×3 pocket). Flood fill, chording, three difficulties. **Facts commit to storage the instant they're recovered, so a loss never touches the Dossier** — punishing exploration would defeat the feature. Stores fact **ids only**, so editing text later doesn't leave stale copies |
| **Snake** | `snake` | Canvas, arrows + WASD + D-pad, speed ramp. Direction changes buffered against the last *applied* direction so fast taps can't reverse it into itself |
| **2048** | `g2048` | CSS grid, arrows + WASD + swipe. Tiles are `motion.div`s keyed by stable id so `layout` does FLIP animation with no manual pixel maths. Single-level undo. **OS tokens, not the standard beige palette** |
| **Project apps** | 4 generated | One `ProjectApp`, N definitions from `content/projects.ts` |
| **About This Macintosh** | `about` | Reached from the logo menu. Memory map fills as you open apps |

---

## 11. The classic 1984 shell

**Visual language — deliberately NOT System 7.** Pure 1-bit: black and white
only, no greys (dither instead), no anti-aliasing, no gradients, no shadows, no
rounded corners. Thin menu bar; windows have a title bar and close box and
nothing else — no dock, no resize, no zoom, no minimize.

**Timing** (`lib/classic/timing.ts`):

| Phase | Normal | Reduced motion |
| --- | --- | --- |
| Startup plate | 850 ms | 250 ms |
| Update notice appears | 2800 ms | 1000 ms |
| Transition total | 1760 ms | 700 ms |
| Safety timeout | 3200 ms | 1600 ms |

Reduced motion **shortens rather than removes** — the transition is the story.

**The seven desk accessories** (`DESK_ACCESSORIES`): `alarm-clock` `calculator`
`control-panel` `key-caps` `note-pad` `puzzle` `scrapbook`.

- **Calculator** — fully functional, keypad + keyboard, pure reducer in
  `lib/classic/calculator.ts`. Escape = Clear and stops propagating so it
  doesn't close the window.
- **Puzzle** — fully functional 15-tile. **`shuffle()` walks legal moves back
  from solved**, because permuting arbitrarily makes half of all boards
  unsolvable. Verified: 500 shuffles all solvable, none already solved.
- **Key Caps / Scrapbook / Control Panel** — partly real: Key Caps highlights
  physical keypresses, Scrapbook pages through generated Bayer-dither art, and
  the Control Panel's pattern picker and menu clock genuinely change the machine.
- **Alarm Clock / Note Pad / About This Machine** — cosmetic.
- **No web browser.** The web didn't exist in 1984 and its absence is the joke.
  Don't add one.

**`UpdateTransition` must call `finishUpdate()`** or the visitor is stranded on a
dead screen. It's wired to both the animation's `onAnimationComplete` **and** a
safety timeout, because a backgrounded tab pauses rAF.

---

## 12. Rishu, the mascot

An original character in the spirit of **Mr. Macintosh** — the figure Steve Jobs
wanted in 1982, that Andy Hertzfeld wired a hook for (`MrMacHook`) and Apple
never shipped. **The look is entirely our own.**

**The design is the *absence* of a trigger.** Three independent low-probability
rolls, all behind a **14 s mount grace**, a cooldown and a per-session cap:

| Roll | Fires on | classic | colour |
| --- | --- | --- | --- |
| idle | 9 s tick, only if untouched ≥7 s and tab visible | 1/16 | 1/100 |
| click | any `pointerdown` | 1/150 | 1/700 |
| tab return | `visibilitychange` → visible | 1/10 | 1/40 |
| cooldown / cap | | 75 s / 3 per session | 240 s / 2 per session |

In English: classic ≈ once per 2½ minutes of uninterrupted staring; colour OS is
4–5× rarer again. **The cooldown plus cap mean that even someone who suspects a
trigger cannot repeat it.**

**There is no test id, no `window.__` global, and no imperative "appear now"
export — on purpose.** The only testable surface is the pure `rollAppearance()`,
which takes an injectable `rng`. **Do not add a DOM escape hatch**; if you can
summon him, the joke is dead.

On screen 1.15 s. `pointer-events: none`. Anchored to edges and corners only,
inset past the dock and menu bar. Reduced motion → static wink + soft fade.

---

## 13. The terminal and its offline brain

**Local commands first** (`lib/terminal/commands.ts`):
`about clear crt date echo exit facts help history ls open projects whoami`

`open <app>` reads the **registry**, so it launches any app including ones added
later. Never hardcode an app list.

**Unrecognised input** → `POST /api/terminal`. That route is
`runtime = 'nodejs'`, reads `process.env.ANTHROPIC_API_KEY`, defaults to
`claude-haiku-4-5-20251001` (override `TERMINAL_MODEL`), validates and caps
input, and rate-limits per IP in memory.

**With no key — or no connection — it falls back to
`lib/terminal/offlineAnswers.ts`**, a pure keyword matcher over `content/` that
actually answers: who you are, what you built, skills, contact, location,
socials, the games, the facts, what this site is, and honest answers about being
local rather than an AI. Falls back to an in-character quip only when nothing
matches. **14 topics; adding one is a single `TOPICS` entry.**

**Critical:** `offline()` takes the user's input, and **all three call sites must
pass it** — including the upstream-failure `catch`. That path is the on-a-plane
case (key configured but unreachable); passing nothing returns a useless quip.
This was a real bug, found and fixed.

The route **always returns 200** with `{ offline: true }` rather than an error —
a dead model isn't a hard failure, it's a 1991 machine with a bad phone line.

**The key never reaches the browser.** No `NEXT_PUBLIC_` variant exists, and a
build-output grep confirms neither the key nor the Anthropic SDK is in
`.next/static`.

---

## 14. Offline guarantee

After `npm install`, nothing makes a network request.

| Would normally phone home | What we do |
| --- | --- |
| Google Fonts | **Vendored** into `app/fonts/` — Silkscreen 400/700 + VT323, latin subset, 14 KB total, OFL text included |
| Body fonts | System stack (Geneva/Verdana/Helvetica) — nothing to download |
| Images | All local, generated by the two scripts |
| Terminal assistant | Answers locally from `content/` |
| Next telemetry | `setup.sh` disables it |

Verified by building **and** running with all outbound traffic blocked, plus
`tests/offline.spec.ts` asserting zero cross-origin requests.

Only `./setup.sh` needs internet, once, for `npm install`.

---

## 15. Tests

9 spec files, run across two Playwright projects (`desktop` 1440×900, `mobile`
Pixel 7). `playwright.config.ts` auto-starts the dev server and points at the
preinstalled Chromium via `PLAYWRIGHT_BROWSERS_PATH`.

| File | Covers |
| --- | --- |
| `boot.spec.ts` | Boot overlay clears; **classic shell is the front door and hands off**; Browser open by default; bio renders; menu bar |
| `windows.spec.ts` | Drag moves it; collapse marks `inert` + dock tile collapsed, restore undoes; close removes from desktop and dock; zoom maximizes/restores; click brings to front |
| `apps.spec.ts` | **Every registered app opens and mounts** (driven from the Apps menu, so it can't rot); project apps generated from content |
| `session.spec.ts` | Notes/Word/Spreadsheet resume after reload, **New** clears |
| `factsweeper.spec.ts` | A recovered fact survives reload; a new disk resets the board **but not the Dossier** |
| `games.spec.ts` | 2048 deals a board and arrows move tiles; Snake mounts and starts |
| `terminal.spec.ts` | `help`, `open paint`, `open nonsense`, `ls`; API 200 + `offline:true`; empty input → 400 not a crash |
| `offline.spec.ts` | Terminal answers locally; **no Google Fonts request**; **zero cross-origin requests** |
| `mobile.spec.ts` | Windows fill the screen; bottom dock, no resize grip; no horizontal scroll; single-tap open |

**`tests/helpers.ts`** exports `boot`, `bootToDesktop`, **`throughClassicShell`**,
`openAppFromMenu`, `registeredAppTitles`, `windowByTitle`, `dockTile`,
`dragWindowBy`, `runTerminal`, `closeWindow`.

**Every test that wants the colour OS must route through `throughClassicShell()`**
— the 1984 screen is the front door now.

**If you add a feature, add a test.** The suite is why this can be handed over.

---

## 16. Traps — don't rediscover these

Each cost real time. None is inferable from the code.

### 16.1 `next/font/google` breaks offline builds
It fetches from `fonts.googleapis.com` **at build time**, so `npm run dev`
hard-fails with no internet — Next's own error says to self-host. Fonts are
vendored in `app/fonts/` and loaded with `next/font/local`. **Don't undo this.**

### 16.2 Next 16 refuses a second dev server per directory
If one is running, a new `npm run dev` on a different port **silently serves
nothing** and you end up testing a **stale** server. This produced a completely
misleading test result mid-build. The error names the PID:
`kill <PID> && rm -rf .next/dev`, then restart. Also: **`pkill -f "next dev"`
can kill your own shell.**

### 16.3 The `.env*` gitignore rule swallowed `.env.example`
`create-next-app` writes a blanket `.env*`. A fresh clone therefore had no
template, so `setup.sh` **and** the README's manual `cp` both failed on anyone
else's machine — invisible locally because the file existed. Fixed with
`!.env.example`. **Always test setup against a clean clone.**

### 16.4 The test-id contract
Renaming any of these breaks the entire suite:

| Test id | Requirement |
| --- | --- |
| `classic-shell` | present while the 1984 screen is up |
| `software-update-action` | must become visible on its own within ~20 s |
| `update-transition` | must **unmount** when the transition finishes |
| `boot-sequence` | colour-OS boot overlay; must detach |

### 16.5 Two image generators, one collision
`generate-placeholders.mjs` and `generate-brand.mjs` were both writing
`desktop/logo.svg` and `boot-mark.svg` — whichever ran last silently clobbered
the other. They now write **disjoint** files and run in any order. Keep it.

### 16.6 The offline fallback needs the input
See §13. All three `offline()` call sites must pass it.

### 16.7 Playwright + preinstalled Chromium
`playwright.config.ts` sets `executablePath` from `PLAYWRIGHT_BROWSERS_PATH`
because the baked-in revision differs from what Playwright expects. **Never run
`playwright install`** in a sandbox that ships one.

### 16.8 Shell `cd` persists between Bash tool calls
A `cd` leaks into the next command. Use absolute paths.

### 16.9 Minimized ≠ unmounted
See §5.4. Don't test it by DOM absence.

### 16.10 Aspect ratios must match the asset
The wordmark used a guessed `0.32` ratio against an asset that is really 228×52
(0.228) — distorting it and tripping a `next/image` warning. Constants now match
the generator.

---

## 17. Settled product decisions

The owner chose these explicitly. **Don't relitigate.**

- **Classic boot runs on every visit, with no skip.** They were offered
  first-visit-only and skippable and chose no skip. The counterweight is that
  the classic screen must stay *short*.
- **`Restart…` returns to 1984**, so the desk accessories stay re-explorable.
- **Fact-sweeper replaced plain Minesweeper**, and **a mine costs the board,
  never the Dossier**.
- **Games are Fact-sweeper, Snake, 2048.** Solitaire was dropped on cost.
- **Mobile is an adaptive OS** below 768px, not a "desktop only" message.
- **Art style: System 7 with colour accents** — not 1-bit, not platinum.
- **`content/` at the repo root** is the single source of truth.
- **Projects are mainly Python** with some frontend/UI work.

---

## 18. Known gaps

Working, but not polished. Recorded honestly — also in `TASKS.md`.

- **Paint** — marquee has no copy/paste; the text tool uses a dialog rather than
  an in-canvas caret.
- **Word** — ruler is decorative (margins aren't draggable); no undo beyond the
  browser's native `contenteditable` undo.
- **Spreadsheet** — single-cell selection only: no drag-select, fill handle or
  column resizing.
- **Classic shell** — Alarm Clock, Note Pad, most of Control Panel and About This
  Machine are cosmetic.
- **Classic windows** don't resize or collapse — correct for 1984, but desk
  accessories are fixed-size.
- **Fonts** ship the `latin` subset only. Fine for English chrome; body copy uses
  a system stack with full coverage.

---

## 19. How this was built (multi-agent)

**Eleven agents across three phases**, coordinated by one session.

| Phase | Agents |
| --- | --- |
| 0 | Coordinator alone: scaffold, contract, frozen types, registry, tokens, primitives, placeholder art |
| 1 | 7 in parallel: OS Shell · Content & Browser · Creative Suite · Terminal/LLM · Fact-sweeper (all Opus) · Arcade Games · Dummy Projects (Sonnet) |
| 2 | 1 QA/integration agent |
| 3 | 3 in parallel: Brand/Assets · Classic Boot · Mascot (all Opus) |

**What made it work — repeat this:**

1. **A coordinator phase that pre-stubs every shared file first.** Seven agents
   in one tree never collided because each owned an exclusive file list and
   every shared file already existed. **That is the whole trick.**
2. **Per-agent manifests, not a shared registry.**
3. **Agents never run `git`, `npm install`, or builds.** The coordinator commits
   for them — concurrent git index writes race, concurrent builds thrash
   `.next/`.
4. **Agents verify with `npx tsc --noEmit` only**, and are told errors in files
   they don't own are expected while others are still writing.
5. **Model-tier by difficulty.** Snake/2048 and the thin project apps went to
   Sonnet; the window manager, spreadsheet engine, LLM route, browser chrome and
   Fact-sweeper stayed on Opus. Give the cheaper tier the **tightest** brief —
   exact primitives, exact tokens, no freehand chrome — and review it first.
6. **Commit per agent**, so each diff is reviewable independently.
7. **Verify agents' claims yourself.** Several reported "done" on things worth
   checking directly — no-`eval`, circular-reference detection, no raw hex, no
   test escape hatch. All held up, but the checks were cheap and one of them
   (the QA agent's untested Playwright suite) genuinely hadn't been run.

**One caution:** the Phase-2 QA agent was killed mid-task by a monthly spend
limit. If you spawn agents, budget for it.

---

## 20. Debugging playbook

| Symptom | Likely cause |
| --- | --- |
| `npm run dev` does nothing / stale behaviour | A dev server is already running — §16.2 |
| Build fails on fonts | Someone reintroduced `next/font/google` — §16.1 |
| Every test fails at once | The test-id contract broke, or `throughClassicShell()` can't find the Install button — §16.4 |
| Brand marks reverted to crude versions | `npm run placeholders` clobbered them — §16.5 |
| Terminal only returns quips | `offline()` isn't being passed the input — §13 |
| Window won't drag | Check `pointer-events` on the window layer; it's `none` by default so bare desktop stays clickable |
| App opens twice | It isn't `singleton` (default true) |
| Hydration mismatch | Reading `localStorage`/`window` during render — use `useAppSession`, which hydrates in an effect |
| Playwright wants to download a browser | `executablePath` isn't resolving — §16.7 |

---

## 21. Deployment

Nothing is deployment-specific. `npm run build && npm start` works.

- `/` is **static**; `/api/terminal` is **dynamic** (server-rendered on demand),
  so the host must support Node — a purely static export would drop the terminal
  assistant, though the terminal itself would still work via its local brain.
- If deploying with a terminal key, set `ANTHROPIC_API_KEY` as a **server env
  var**, never a build arg. `TERMINAL_MODEL` optionally overrides the model.
- The in-memory rate limiter is **per instance**. On multi-instance hosting it
  limits per instance, not globally. Fine at portfolio scale; swap for something
  shared if that ever matters.
- Node ≥ 20.9 (declared in `package.json` `engines`).

---

## 22. Suggested next steps

Nothing is broken; these are opportunities.

1. **Replace the placeholder content**, starting with `content/bio.ts`.
   Everything is obviously templated right now.
2. **Real projects** into `content/projects.ts` (one array entry each) and real
   screenshots into `public/images/projects/` with the same filenames.
3. **Real facts** into `content/facts.ts` — aim for 40+, and put the genuinely
   interesting ones in `rare` so the hard board is worth playing.
4. **A real 32×32 1-bit portrait** — currently a generic bust, generated by
   `scripts/generate-brand.mjs`.
5. **Deploy**, then open a PR to `main` (this branch has never been merged).
6. Close the §18 gaps if the owner wants them.

---

## 23. Glossary

| Term | Means |
| --- | --- |
| **Colour OS** | The System 7 desktop — the main portfolio |
| **Classic shell** | The 1984 black-and-white front door |
| **Stage** | Which shell is mounted: `classic` / `updating` / `color` |
| **The handoff** | The Software Update transition between them |
| **Dossier** | Fact-sweeper's persistent panel of recovered facts |
| **Rishu** | The unsummonable mascot |
| **Manifest** | One `lib/apps/*.apps.ts` file, owned by one original agent |
| **Frozen** | A file that shouldn't be edited — §4.5 |
| **Genie-lite** | The minimize animation that flies a window into its dock tile |
