# HANDOFF.md — read this first

You are picking up a finished, working project. This file is the context that
isn't obvious from the code: what was decided and why, what's deliberately the
way it is, and the traps that cost real time to find.

**Read this, then `CONTRACT.md`. Skim `README.md` for how to run it.**

Branch: `claude/90s-os-portfolio-174tcv` · Repo: `Rishu-N/laughing-train`
Everything is committed and pushed. No PR has been opened (none was requested).

---

## 1. What this is

A personal portfolio that presents itself as a Macintosh operating system.

Every visit boots a **1984 black-and-white machine** (thin menu bar, 1-bit UI,
working desk accessories). A few seconds in, a **"Software Update Available"**
notice drops in from the top-left. Accepting it plays a dither-dissolve
transition and hands off to a **System 7 colour desktop**, where a 1996-era web
browser is already open showing the owner's bio, alongside a paint program, a
word processor, a spreadsheet, an LLM-wired terminal, one app per project, and
three games. `Restart…` in the logo menu returns to 1984.

A mascot called **Rishu** appears rarely in both shells and cannot be summoned.

The owner is **Rishu N** (`rishunandaarav2003@gmail.com`). All content is
placeholder — they will fill in the real thing later, and **other agents may be
asked to populate `content/projects.ts` programmatically.**

---

## 2. State: everything works

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | clean |
| `npx eslint .` | clean |
| `npm run build` | clean (`/` static, `/api/terminal` dynamic) |
| `npm run test:e2e` | **56 passed, 0 failed**, 14 skipped |
| Security | no API key material and no Anthropic SDK in `.next/static` |
| Offline | builds and runs with all outbound network blocked |

The 14 skips are **by design** — desktop-only specs skip on the mobile project
and vice versa. Don't "fix" them.

**Registered app ids:** `about` `browser` `factsweeper` `g2048` `notes` `paint`
`snake` `spreadsheet` `terminal` `word`, plus four generated project apps
(`cli-tool` `data-pipeline` `scraper-bot` `ui-playground`).

---

## 3. Rules you must not break

These are load-bearing. Breaking any of them is a regression even if tests pass.

### 3.1 No Apple trademarks, anywhere
The owner asked for this explicitly. **No bitten apple, no rainbow logo, no
Happy Mac smiling-computer icon, no recreations of Susan Kare's bitmaps.**
Style-inspired only — 1-bit pixels and chunky letterforms are a *medium*, not a
mark.

Phase 0 originally generated a literal Happy Mac and a rainbow-striped logo.
Both were **deleted** and replaced with originals (an abstract four-point spark,
an `R` monogram, a pixel-caps "Rishu Inc" wordmark, a generic 1-bit bust). If
you regenerate art, keep it original. `SYSTEM_IMAGES.happyMac` no longer
exists — it is `bootMark`.

### 3.2 Content lives in `content/`, never in components
The owner edits `content/`, and **a future agent may populate
`content/projects.ts` programmatically**. That only works if no component
embeds content.

```
content/types.ts      FROZEN schemas
content/bio.ts        name, tagline, about, skills, socials, email
content/projects.ts   Project[] — ONE ENTRY = ONE APP, no code needed
content/facts.ts      Fact[] — 51 facts revealed by Fact-sweeper
content/terminal.ts   assistant persona + offline quips
content/images.ts     FROZEN image path constants
```

UI chrome labels ("New", "Cancel", column headers) legitimately live in
components. Biographical/project/fact *content* does not.

### 3.3 It must keep running fully offline
After `npm install`, **nothing makes a network request.** `tests/offline.spec.ts`
asserts the page makes zero cross-origin requests. In particular: **never
reintroduce `next/font/google`** (see §5.1).

### 3.4 Window layout is deliberately not persisted
Documents persist (`useAppSession`); the desk does not. Every load is a cold
boot, which is what guarantees the Browser is the first thing you see. Adding
layout persistence would break a stated requirement.

---

## 4. Architecture, and the non-obvious decisions

```
app/page.tsx            renders <Stage />
components/stage/       the classic → updating → colour machine
components/classic/     the 1984 shell (its own small world, see below)
components/mascot/      Rishu
components/os/          the colour System 7 shell
components/os/ui/       shared System 7 primitives — FROZEN
components/apps/<name>/ one folder per colour-OS app
lib/os/                 stageStore, windowStore, registry, persist, layers, types
lib/classic/            1-bit logic: dither, calculator, puzzle, timing
lib/terminal/           command parser + offlineAnswers
content/                everything user-editable
app/fonts/              VENDORED woff2 — do not replace with next/font/google
```

**Registry of manifests.** `lib/os/registry.ts` is the union of seven
`lib/apps/*.apps.ts` manifests. This indirection exists because **seven agents
built this in parallel in one tree** — each owned one manifest, so nobody ever
edited a shared registry. Keep it; it also means nothing has a hardcoded app
list (the Apps menu, dock, boot screen and terminal `ls`/`open` all read it).

**Two shells, one stage machine.** `lib/os/stageStore.ts` holds
`classic → updating → color`. The classic shell deliberately **does not** reuse
the System 7 window manager or `components/os/ui` primitives — 1-bit windows
have no bevel, no dock, no resize, no zoom, and threading a `variant` flag
through chrome that shares almost nothing would cost more than it saves. This is
the one place the shared-primitive rule is intentionally suspended.

`Stage` keys the colour `Desktop` on a **generation counter**, so `Restart…`
genuinely replays the boot and re-opens the Browser instead of reusing the
previous mount's window state.

**Minimized windows stay MOUNTED** — marked `inert` with `pointer-events: none`,
not unmounted. That is what lets the genie-lite minimize animation run and
preserves app state across a collapse. **Consequence for tests: you cannot
assert "minimized" by absence from the DOM.**

**One project component, N apps.** `lib/apps/projects.apps.ts` maps over
`content/projects.ts` and generates one `AppDefinition` per entry, all pointing
at a single `ProjectApp`. Adding a project is one array entry — no new
component, no registry edit.

---

## 5. Traps that cost real time — don't rediscover these

### 5.1 `next/font/google` breaks offline builds
It fetches from `fonts.googleapis.com` **at build time**, so `npm run dev`
hard-fails with no internet. Silkscreen and VT323 are vendored into `app/fonts/`
(14 KB, latin subset, OFL text included) and loaded with `next/font/local`.
Don't undo this.

### 5.2 Next 16 refuses a second dev server per directory
If one is already running, a new `npm run dev` on a different port **silently
serves nothing** and you end up testing a *stale* server. This produced a
completely misleading test result during development. The error names the PID —
`kill <PID>`, `rm -rf .next/dev`, then restart. Also: `pkill -f "next dev"` can
kill your own shell.

### 5.3 The `.env*` gitignore rule swallowed `.env.example`
`create-next-app` writes a blanket `.env*`. That meant a fresh clone had no
template, so `setup.sh` *and* the README's manual `cp` both failed on anyone
else's machine — invisible locally because the file existed. Fixed with
`!.env.example`. **Always test setup against a clean clone**, not your working
tree.

### 5.4 Every test routes through the classic shell
Since the 1984 shell became the front door, `tests/helpers.ts` exports
`throughClassicShell()` and every test that wants the colour OS goes through it.
Three test ids are a **hard contract** — renaming them breaks the whole suite:

| Test id | Requirement |
| --- | --- |
| `classic-shell` | present while the 1984 screen is up |
| `software-update-action` | must become visible on its own within ~20s |
| `update-transition` | must **unmount** when the transition finishes |

### 5.5 Two image generators, one collision
`generate-placeholders.mjs` and `generate-brand.mjs` were both writing
`desktop/logo.svg` and `boot-mark.svg`, so whichever ran last silently clobbered
the other. They now write **disjoint** files and can run in any order. Keep it
that way.

### 5.6 The terminal's offline fallback needs the input
`offline()` in `app/api/terminal/route.ts` takes the user's input and answers
locally via `lib/terminal/offlineAnswers.ts`. **All three call sites must pass
it** — including the upstream-failure `catch`. That path is the on-a-plane case:
a key configured but unreachable. Passing nothing there returns a useless quip.

### 5.7 Playwright + preinstalled Chromium
`playwright.config.ts` sets `executablePath` from `PLAYWRIGHT_BROWSERS_PATH`
because the baked-in browser revision differs from what Playwright expects.
**Never run `playwright install`** in a sandbox that ships one.

### 5.8 Shell `cd` persists between Bash tool calls
A `cd` in one command leaks into the next. Use absolute paths.

---

## 6. Product decisions already made — don't relitigate

The owner chose these explicitly:

- **Classic boot runs on every visit, with no skip.** They were offered
  first-visit-only and skippable; they chose no skip. The counterweight is that
  the classic screen must stay *short* (banner at 2.8s, handoff ~2.15s).
- **`Restart…` returns to 1984** so the desk accessories stay re-explorable.
- **Fact-sweeper replaced plain Minesweeper.** Clearing safe cells reveals
  personal facts into a persistent Dossier. **Hitting a mine costs the board,
  never the Dossier** — punishing exploration would defeat the feature.
- **Games are Fact-sweeper, Snake, 2048.** Solitaire was dropped (cost).
- **Mobile is an adaptive OS** below 768px: windows fill the screen, drag/resize
  off, dock moves to the bottom.
- **Art style is System 7 with colour accents**, not 1-bit and not Mac OS 8
  platinum.
- **The `content/` folder is the single source of truth**, at the repo root.

---

## 7. Known gaps (working, but not polished)

Recorded honestly rather than implied finished — see `TASKS.md`.

- **Paint** — marquee has no copy/paste; the text tool places text via a dialog
  rather than an in-canvas caret.
- **Word** — the ruler is decorative (margins aren't draggable); no undo beyond
  the browser's native `contenteditable` undo.
- **Spreadsheet** — single-cell selection only: no drag-select, fill handle or
  column resizing. (Formulas are solid: hand-written parser, no `eval`, with
  `#CIRC!` detection for self- and mutual cycles.)
- **Classic shell** — Alarm Clock, Note Pad, most of Control Panel and About
  This Machine are cosmetic. Calculator, Puzzle, Key Caps, Scrapbook and the
  Control Panel's pattern picker genuinely work.
- **Classic windows** don't resize or collapse — correct for 1984, but it means
  desk accessories are fixed-size.

---

## 8. How to work on it

```bash
./setup.sh            # idempotent; checks Node >=20.9, installs, configures
npm run dev           # http://localhost:3000
npm run typecheck && npm run lint && npm run build
npm run test:e2e      # expect 56 passed / 0 failed / 14 skipped
npm run placeholders  # regenerate placeholder art
npm run brand         # regenerate brand marks
```

The terminal works with **no API key** — it answers locally. Add
`ANTHROPIC_API_KEY` to `.env.local` only to make the assistant live; the route
is `runtime = 'nodejs'`, the key never reaches the browser, and there is no
`NEXT_PUBLIC_` variant anywhere.

**If you add a feature, add a test.** The suite is the reason this can be
handed over at all.

---

## 9. If you continue the multi-agent pattern

This was built by **eleven agents across three phases**, coordinated by one
session. What made it work, and what to repeat:

1. **A coordinator phase that pre-stubs every shared file first.** Seven agents
   in one tree never collided because each owned an exclusive file list and
   every shared file already existed. That is the whole trick.
2. **Per-agent manifests, not a shared registry.**
3. **Agents never run `git`, `npm install`, or builds.** The coordinator commits
   their work — concurrent git index writes race, and concurrent builds thrash
   `.next/`.
4. **Agents verify with `npx tsc --noEmit` only**, and are told that errors in
   files they don't own are expected while others are still writing.
5. **Model-tier by difficulty.** Snake/2048 and the thin project apps went to
   Sonnet; the window manager, spreadsheet engine, LLM route, browser chrome and
   Fact-sweeper stayed on Opus. Give the cheaper tier the *tightest* brief —
   exact primitives, exact tokens, no freehand chrome — and review it first.
6. **Commit per agent** so each diff is reviewable independently.

`CONTRACT.md` and `CONTRACT-PHASE3.md` are the briefs those agents were given.
Reuse their structure.

---

## 10. Suggested next steps

Nothing is broken; these are opportunities.

1. **Replace the placeholder content** — `content/bio.ts` first. Everything is
   obviously templated right now.
2. **Real projects** into `content/projects.ts` (one array entry each) and real
   screenshots into `public/images/projects/` with the same filenames.
3. **A real 32×32 1-bit portrait** of the owner — currently a generic bust
   (`public/images/brand/classic-portrait.png`, generated by
   `scripts/generate-brand.mjs`).
4. **Deploy.** Nothing is deployment-specific; `npm run build && npm start`
   works. If deploying with a terminal key, set `ANTHROPIC_API_KEY` as a server
   env var — never a build arg.
5. Close the §7 gaps if the owner wants them.
