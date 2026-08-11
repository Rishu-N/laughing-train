# TASKS.md — build progress

Seven Phase-1 agents work in parallel in one tree, each confined to its own files.
Ownership is the collision-avoidance mechanism — see `CONTRACT.md` §1.

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
- [x] `npx tsc --noEmit` and `npm run build` clean

## Phase 1 — parallel agents

| # | Agent | Model | Status |
| --- | --- | --- | --- |
| 1 | OS Shell | Opus | ⏳ |
| 2 | Content & Identity (bio + Browser) | Opus | ⏳ |
| 3 | Creative Suite (Paint/Notes/Word/Spreadsheet) | Opus | ⏳ |
| 4 | Terminal + LLM route | Opus | ⏳ |
| 5 | Fact-sweeper | Opus | ⏳ |
| 6 | Arcade Games (Snake, 2048) | Sonnet | ⏳ |
| 7 | Dummy Projects | Sonnet | ⏳ |

## Phase 2 — QA / Integration

- [ ] Registry wiring, no duplicate app ids
- [ ] `tsc` / `lint` / `build` clean
- [ ] Content audit — no hardcoded bio/project/fact strings in components
- [ ] Playwright smoke suite (boot → Browser default → drag/minimize/restore/close →
      every app opens → resume-session round trip → terminal `help` + `open paint`)
- [ ] API key leak check against the built client bundle
- [ ] Responsiveness at 375 / 768 / 1440
- [ ] `README.md` with the where-to-edit table

## Functional checklist (from the original request)

- [ ] Boots into a desktop; Browser open by default showing the bio
- [ ] Top-right logo → dropdown → About Me + socials
- [ ] Paint with tool palette + preloaded pixel self-portrait
- [ ] Terminal wired to an LLM, opens with a help list, `open <app>` works
- [ ] Notes / Word / Spreadsheet resume last session, each with a "New" action
- [ ] One app per project, data-driven from `content/projects.ts`
- [ ] Three games — Fact-sweeper (reveals personal facts), Snake, 2048
- [ ] Dock on the right listing running apps
- [ ] `/public/images` with clearly labeled placeholder slots
- [ ] Everything client-side except the terminal's LLM call
