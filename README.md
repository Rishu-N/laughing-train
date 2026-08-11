# A portfolio that boots

A personal portfolio built as a **Macintosh System 7 desktop**. It boots with a
Happy Mac, opens a 1996-era web browser showing your bio, and everything else —
your projects, a paint program, a word processor, a spreadsheet, a terminal
wired to an LLM, and three games — is an app you can open, drag, collapse into
the dock and close.

Everything runs in the browser. The only server-side code in the whole project
is one API route for the Terminal's assistant, and even that is optional.

---

## Quickstart

```bash
npm install
npm run dev            # http://localhost:3000
```

That's it — no configuration, no API keys, no database. Other scripts:

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright smoke suite (boots the dev server itself) |
| `npm run placeholders` | Regenerate the placeholder images in `public/images/` |

### The optional terminal key

The Terminal parses `help`, `ls`, `open <app>`, `whoami`, `projects` and friends
locally. Anything it doesn't recognise is passed to an LLM — **if** you've given
it a key.

```bash
cp .env.example .env.local
# then edit .env.local:
ANTHROPIC_API_KEY=sk-ant-...
# TERMINAL_MODEL=claude-haiku-4-5-20251001   # optional, this is the default
```

**Without a key everything still works.** `POST /api/terminal` answers `200` with
`{ offline: true }` and one of the in-character lines from
`content/terminal.ts`, so the Terminal stays fun out of the box. The key is read
only in `app/api/terminal/route.ts`, is never sent to the browser, and there is
no `NEXT_PUBLIC_` variant of it anywhere in the repo.

---

## Where to put your real stuff

Everything a visitor reads lives in `content/`. **No component embeds content**,
so you never have to open a `.tsx` file to change what the site says.

| What | Goes in | Notes |
| --- | --- | --- |
| Your bio | `content/bio.ts` | Name, tagline, about paragraphs, skills, socials, email. Start here — for many people this is the only file they touch |
| Your projects | `content/projects.ts` | **One array entry = one app.** No code needed: the app appears in the Apps menu, the dock and `open <id>` automatically |
| Personal facts for Fact-sweeper | `content/facts.ts` | One per revealed cell. `rarity` gates which board it can appear on |
| Terminal persona | `content/terminal.ts` | Banner, voice/rules for the assistant, and the offline one-liners |
| Images | `public/images/` | Drop your file in with the **same filename** and it appears everywhere. Prefer a different filename? Change the path in `content/images.ts` |

`content/README.md` documents every field of every file, including which ones
are optional and where each one shows up on screen.

---

## Architecture in brief

```
app/
  page.tsx              renders <Desktop /> — the entire OS is one route
  api/terminal/route.ts the ONLY server-side code
  globals.css           design tokens (@theme) + System 7 chrome utilities
components/
  os/                   the shell: Desktop, Window, MenuBar, Dock, BootSequence
  os/ui/                shared System 7 primitives (Button, Dialog, AppFrame…)
  apps/<name>/          one folder per app
lib/
  os/windowStore.ts     the window manager (Zustand)
  os/registry.ts        the app registry — the union of every manifest
  os/persist.ts         useAppSession: debounced, SSR-safe session storage
  apps/*.apps.ts        app manifests
content/                everything user-editable
public/images/          placeholder art, labelled by slot
```

**Window manager.** `lib/os/windowStore.ts` owns every open window: position,
size, focus, z-index, minimize and maximize. Components never set a z-index
themselves — windows start at `LAYERS.windowBase` and take the next value on
focus, with reserved layers for the dock, menu bar and boot overlay in
`lib/os/layers.ts`. Window *layout* is deliberately **not** persisted: every page
load is a cold boot, which is what guarantees the Browser is the first thing you
see. Documents are persisted; the desk is not.

**Registry of manifests.** `lib/os/registry.ts` is the union of the
`lib/apps/*.apps.ts` manifests, each exporting an array of `AppDefinition`. The
registry drives the Apps menu, the desktop icons, the boot screen's extension
row, and the Terminal's `ls` / `open` / tab completion. Nothing has a hardcoded
list of apps.

**Content folder.** Components read from `content/` and never embed strings.
That is what makes `content/projects.ts` safe to regenerate programmatically.

**Minimize keeps windows mounted.** A collapsed window stays in the DOM, marked
`inert` with `pointer-events: none`. That's what lets it animate into its dock
tile and keeps the app's state alive while it's away.

**Responsive.** Below 768px the OS goes single-window: windows fill the screen,
drag and resize turn off, and the dock becomes a bottom bar. Every app is usable
at 375px, and the page body never scrolls horizontally.

---

## Adding a new app

1. Write the component in `components/apps/<name>/<Name>App.tsx`. It receives
   `{ instanceId, appId, params?, setTitle, close }` and renders *inside* an
   existing window frame — no title bar, border or shadow of its own. Fill the
   space with `h-full w-full`, or use `<AppFrame>` from `@/components/os/ui`.
2. Register it in a manifest under `lib/apps/`:

```ts
import dynamic from 'next/dynamic';
import { APP_ICONS } from '@/content/images';
import type { AppDefinition } from '@/lib/os/types';

// ssr: false is required — apps touch canvas, localStorage and window.
const ThingApp = dynamic(() => import('@/components/apps/thing/ThingApp'), { ssr: false });

export const apps: AppDefinition[] = [
  {
    id: 'thing',                     // kebab-case, unique, typeable: `open thing`
    title: 'Thing',
    icon: APP_ICONS.project,
    category: 'creative',            // system | creative | project | game
    component: ThingApp,
    defaultSize: { width: 640, height: 460 },
    minSize: { width: 320, height: 240 },
    showOnDesktop: true,
    description: 'What it does, in one line.',
  },
];
```

That's the whole job. `lib/os/registry.ts` picks the manifest up automatically,
so the app now has a desktop icon, an Apps-menu row, a dock tile when open, and
`open thing` in the Terminal.

3. Need to remember a document between visits? Use the one mechanism:

```ts
const [doc, setDoc, reset, hydrated] = useAppSession('thing', { text: '' });
```

Debounced, SSR-safe, flushes on unmount and tab-hide. Wire `reset` to an
explicit "New" action behind a `ConfirmDialog`. Don't hand-roll `localStorage`.

**A project doesn't need any of this** — add an entry to `content/projects.ts`
and an app is generated for you.

---

## Tests

```bash
npm run test:e2e
```

Playwright, two projects: desktop at 1440×900 and a Pixel 7. The suite covers
the boot sequence and the Browser being open by default, window drag /
collapse / restore / close, every registered app opening and mounting (driven
from the registry, so it extends itself as you add apps), the Notes / Word /
Spreadsheet resume-session round trip, Fact-sweeper's dossier surviving a
reload, the Terminal's local commands, the `offline: true` API contract, and the
mobile layout.

---

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Zustand ·
Framer Motion. Tailwind v4 has no `tailwind.config.js` — design tokens are
declared with `@theme` in `app/globals.css` and become utilities automatically.
