# TASKS.md — build progress

Seven Phase-1 agents worked in parallel in one tree, each confined to its own files.
Ownership was the collision-avoidance mechanism — see `CONTRACT.md` §1.

## Phase 0 — Coordinator ✅

- [x] Next.js 16 + TS + Tailwind v4 scaffold, all deps installed once
- [x] `lib/os/types.ts`, `layers.ts`, `persist.ts`, `windowStore.ts`, `registry.ts`
- [x] Seven manifest stubs in `lib/apps/`
- [x] `content/` folder: frozen `types.ts`, `images.ts`, data stubs
- [x] Design tokens + chrome utilities in `app/globals.css`
- [x] Shared primitives in `components/os/ui/`
- [x] Placeholder asset generator (`npm run placeholders`) — 23 assets
- [x] Working baseline Desktop / Window / MenuBar / Dock / Boot
- [x] `CONTRACT.md`, `TASKS.md`, `.env.example`

## Phase 1 — parallel agents ✅

| # | Agent | Model | Status |
| --- | --- | --- | --- |
| 1 | OS Shell | Opus | ✅ |
| 2 | Content & Identity (bio + Browser) | Opus | ✅ |
| 3 | Creative Suite (Paint/Notes/Word/Spreadsheet) | Opus | ✅ |
| 4 | Terminal + LLM route | Opus | ✅ |
| 5 | Fact-sweeper | Opus | ✅ |
| 6 | Arcade Games (Snake, 2048) | Sonnet | ✅ |
| 7 | Dummy Projects | Sonnet | ✅ |

## Phase 2 — QA / Integration ✅

- [x] Registry wiring, no duplicate app ids
- [x] `npx tsc --noEmit` clean
- [x] `npx eslint .` clean — the g2048 `set-state-in-effect` error was fixed, not silenced
- [x] `npm run build` clean (`/` static, `/api/terminal` dynamic)
- [x] Content audit — no hardcoded bio/project/fact strings in components
- [x] **Playwright suite: 46 passed, 0 failed** (14 skipped by design — desktop-only
      specs skip on the mobile project and vice versa)
- [x] API key leak check — no key material and no Anthropic SDK in `.next/static`
- [x] Responsiveness pass at 375 / 768 / 1440
- [x] `README.md` with the where-to-edit table; `content/README.md` field guide

## Functional checklist (from the original request)

- [x] Boots into a desktop; Browser open by default showing the bio
- [x] Top-right logo → dropdown → About Me + socials
- [x] Paint with tool palette + preloaded pixel self-portrait
- [x] Terminal wired to an LLM, opens with a help list, `open <app>` works
- [x] Notes / Word / Spreadsheet resume last session, each with a "New" action
- [x] One app per project, data-driven from `content/projects.ts`
- [x] Three games — Fact-sweeper (reveals personal facts), Snake, 2048
- [x] Dock on the right listing running apps
- [x] `/public/images` with clearly labeled placeholder slots
- [x] Everything client-side except the terminal's LLM call

## Known gaps (working, but not polished)

- Paint: marquee has no copy/paste; the text tool places text via a dialog rather
  than an in-canvas caret.
- Word: the ruler is decorative — margins aren't draggable; no undo beyond the
  browser's native `contenteditable` undo.
- Spreadsheet: single-cell selection only — no drag-select, fill handle or column
  resizing.

## Phase 3 — Classic 1984 boot + Software Update + Rishu mascot ✅

| # | Agent | Model | Status |
| --- | --- | --- | --- |
| A | Brand / Assets | Opus | ✅ |
| B | Classic Boot shell | Opus | ✅ |
| C | Rishu mascot | Opus | ✅ |

- [x] Classic 1-bit shell is the front door, every visit, no skip
- [x] Seven desk accessories; **Calculator and Puzzle genuinely functional**
- [x] No web browser on the classic screen (correct for 1984)
- [x] "Software Update Available" drops in from the top left at 2.8s
- [x] Dissolve transition hands off to the colour OS (~2.15s), with a safety
      timeout so a dropped animation callback can't strand the visitor
- [x] `Restart…` in the colour OS logo menu returns to 1984
- [x] Rishu appears rarely in both shells, rarer in colour, with no summonable trigger
- [x] Original brand marks: classic mark, "Rishu Inc" wordmark, 32×32 1-bit portrait
- [x] **Trademark cleanup done** — `happy-mac.svg` and the rainbow `logo.svg` are
      gone, replaced by originals. No Apple trademark or artwork anywhere.
- [x] `tsc`, `eslint`, `build` clean; **e2e 48 passed / 0 failed** through the new
      front door

### Phase 3 known gaps

- Alarm Clock, Note Pad, most of Control Panel and About This Machine are cosmetic
  homages rather than working software. Scrapbook, Key Caps and the Control Panel's
  pattern picker do work.
- The classic shell has no window resize or collapse — correct for 1984, but it does
  mean the desk accessories are fixed-size.
