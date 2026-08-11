# CONTRACT.md — the shared contract every agent builds against

You are one of seven agents building a 90s Macintosh-style portfolio OS in a single
working tree. **Read this file completely before writing any code.** It exists so
seven parallel agents produce one coherent operating system instead of seven
different ones.

---

## 1. Hard rules (violating these breaks other agents)

1. **Only touch files on your ownership list.** Every file in this repo is owned by
   exactly one agent. If you need a change outside your list, report it to the
   coordinator instead of making it.
2. **Never run `npm install`.** All dependencies are already installed. Concurrent
   installs corrupt `node_modules` for everyone.
3. **Never run `npm run build` or `npm run dev`.** Concurrent builds thrash `.next/`.
   Verify with **`npx tsc --noEmit`** only. The coordinator and the QA agent run builds.
4. **Never run any `git` command.** The coordinator commits your work for you.
5. **Never edit** `app/globals.css`, `lib/os/registry.ts`, `lib/os/types.ts`,
   `lib/os/layers.ts`, `lib/os/persist.ts`, `content/types.ts`, `content/images.ts`,
   or anything in `components/os/ui/`. These are shared and frozen.
6. **Never hardcode user-editable content in a component.** Bio text, project
   details, personal facts and image paths come from `content/`. This is the single
   most important rule in the project — see §6.

---

## 2. Stack

Next.js 16.3 (App Router) · React 19.2 · TypeScript · Tailwind **v4** · Zustand 5 ·
Framer Motion 13. Import alias is `@/*` → repo root.

Tailwind v4 has **no `tailwind.config.js`**. Tokens are declared with `@theme` in
`app/globals.css` and become utilities automatically (`--color-os-face` →
`bg-os-face`, `text-os-face`, `border-os-face`).

---

## 3. Folder layout

```
app/
  layout.tsx            fonts + metadata          (coordinator)
  page.tsx              renders <Desktop />        (coordinator)
  globals.css           design tokens — FROZEN     (coordinator)
  api/terminal/route.ts server-only LLM call       (Terminal agent)
components/
  os/                   shell: Desktop, Window, MenuBar, Dock, Boot  (OS Shell agent)
  os/ui/                shared primitives — FROZEN, read-only
  apps/<app-name>/      one folder per app         (that app's agent)
lib/
  os/types.ts           AppDefinition etc — FROZEN
  os/layers.ts          z-index + metrics — FROZEN
  os/persist.ts         useAppSession — FROZEN
  os/registry.ts        app registry — FROZEN
  os/windowStore.ts     window manager             (OS Shell agent)
  apps/*.apps.ts        one manifest per agent
content/                ALL user-editable content — see §6
public/images/          generated placeholders
```

---

## 4. Registering an app

You never edit the registry. You add `AppDefinition`s to **your own manifest** at
`lib/apps/<yours>.apps.ts`, and `lib/os/registry.ts` picks them up automatically.

```ts
import dynamic from 'next/dynamic';
import { APP_ICONS } from '@/content/images';
import type { AppDefinition } from '@/lib/os/types';

// ssr: false is REQUIRED — apps touch canvas, localStorage and window.
const PaintApp = dynamic(() => import('@/components/apps/paint/PaintApp'), {
  ssr: false,
});

export const apps: AppDefinition[] = [
  {
    id: 'paint',                  // kebab-case, globally unique, typeable:
                                  // this is what `open paint` uses in the terminal
    title: 'Paint',
    icon: APP_ICONS.paint,
    category: 'creative',
    component: PaintApp,
    defaultSize: { width: 640, height: 460 },
    minSize: { width: 420, height: 320 },
    showOnDesktop: true,
    description: 'Draw something. MacPaint, roughly.',
  },
];
```

Full type: `lib/os/types.ts`. Defaults worth knowing — `resizable: true`,
`singleton: true` (re-opening focuses the existing window rather than duplicating),
`showOnDesktop: false`. Omit `defaultPosition` to let the window manager cascade.

**Your app component** receives `AppWindowProps`:

```ts
{ instanceId, appId, params?, setTitle(t), close() }
```

It renders *inside* an existing window frame — do not draw your own title bar,
border, or shadow. Fill the space you're given (`h-full w-full`).

---

## 5. Window manager API

```ts
import { useWindowStore } from '@/lib/os/windowStore';

// In a component:
const openApp = useWindowStore((s) => s.openApp);
openApp('paint');

// Outside React (e.g. the terminal's command parser):
useWindowStore.getState().openApp('paint');
```

Available: `openApp(id, opts?)`, `closeWindow`, `minimizeWindow`, `restoreWindow`,
`toggleMinimize`, `toggleMaximize`, `focusWindow`, `moveWindow`, `resizeWindow`,
`setTitle`, `closeAll`.

**z-index is not yours to set.** Windows start at `LAYERS.windowBase` (100) and take
the next value on focus; the store renormalizes past `LAYERS.windowCeiling`. Reserved
layers live in `lib/os/layers.ts` (`dock` 9000, `menuBar` 9500, `menuPopover` 9600,
`boot` 9900). Never write a raw z-index above 100 in a component.

---

## 6. Content lives in `content/` — the most important rule

The user is going to replace all of this with real content, and **other agents will
later populate `content/projects.ts` programmatically**. That only works if
components read data and never embed it.

```
content/types.ts     schemas — FROZEN, read it before writing data
content/bio.ts       Bio          (Content & Identity agent)
content/projects.ts  Project[]    (Dummy Projects agent)
content/facts.ts     Fact[]       (Fact-sweeper agent)
content/terminal.ts  persona      (Terminal agent)
content/images.ts    image paths — FROZEN
```

**Wrong:**
```tsx
<h1>Rishu N</h1>
<p>I build things in Python.</p>
```

**Right:**
```tsx
import { bio } from '@/content/bio';
<h1>{bio.name}</h1>
{bio.about.map((p, i) => <p key={i}>{p}</p>)}
```

The QA agent greps for hardcoded strings at the end. Anything found gets sent back.

UI chrome text — button labels like "New", "Cancel", column headers, menu names —
is *not* content. Those stay in components.

---

## 7. Session persistence

One mechanism, already written:

```ts
import { useAppSession } from '@/lib/os/persist';

const [doc, setDoc, reset, hydrated] = useAppSession('notes', { text: '' });
```

Debounced, SSR-safe, flushes on unmount and tab-hide. **Do not hand-roll
localStorage.** Namespace your key with your app id.

Apps that must resume last session on open: **Notes, Word, Spreadsheet** (explicit
"New" action behind a `ConfirmDialog`), plus Paint's canvas and Fact-sweeper's
dossier and high scores.

The OS deliberately **does not** persist window layout — every load is a fresh boot,
which is what guarantees the Browser is the default open window. Do not add layout
persistence.

---

## 8. Design system

**Look:** Macintosh System 7 — 1px pure-black outlines, hard offset drop shadows,
pinstriped title bars, chunky bevels — with colour accents (coloured desktop
pattern, coloured app icons). Not Windows 95, not Mac OS 8 platinum gradients.

**Use the tokens, not raw hex.** From `@theme` in `app/globals.css`:

| Token | Utility | Use for |
| --- | --- | --- |
| `--color-os-desktop` | `bg-os-desktop` | desktop backdrop |
| `--color-os-face` | `bg-os-face` | window content background |
| `--color-os-chrome` | `bg-os-chrome` | toolbars, palettes, dock |
| `--color-os-chrome-dark` | | bevel shadow edge |
| `--color-os-well` | `bg-os-well` | scroll troughs, sunken areas |
| `--color-os-ink` / `-ink-soft` | `text-os-ink` | text, borders |
| `--color-os-accent` | `bg-os-accent` | selection / highlight |
| `--color-os-alert` / `-warn` / `-ok` | | status colours, used sparingly |
| `--color-os-phosphor` | `text-os-phosphor` | terminal green |

**Utility classes** (also in `globals.css`): `os-window`, `os-pinstripe`, `os-bevel`,
`os-bevel-in` (pressed), `os-inset` (sunken), `os-button`, `os-button-default`,
`pixelated`, `os-scroll` (chunky scrollbars), `os-chrome-text`.

**Fonts:** `font-[family-name:var(--font-os-ui)]` for chrome (pixel font — 9–11px
only, it's unreadable larger), `--font-os-body` for paragraphs, `--font-os-mono` for
the terminal. Chrome text should be `os-chrome-text` (sets font + disables selection).

**Shared primitives — import these, never reimplement:**

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

`AppFrame` is the standard app interior (optional toolbar / sidebar / status bar +
scrolling body). It is `relative`, so a `Dialog` rendered inside it dims only your
app, not the desktop. Use it unless you have a reason not to.

---

## 9. Responsive

Below **768px** (`MOBILE_BREAKPOINT`) the OS goes single-window: windows fill the
screen, drag and resize are off, the dock moves to the bottom. Use
`useIsMobile()` from `@/components/os/useIsMobile` if your app needs to adapt (e.g.
collapse a sidebar). Your app must be usable at **375px wide**. Wide content
(spreadsheet grids, game boards) scrolls inside its own container — the page body
must never scroll horizontally.

---

## 10. Accessibility & quality bar

- Every icon-only control needs an accessible name (`IconButton` takes `label`).
- Keyboard: dialogs close on Escape; games accept arrow keys; the terminal takes focus
  on open.
- Respect `prefers-reduced-motion` — `globals.css` already neutralizes animation
  durations globally, so don't fight it with inline JS animation loops that ignore it.
- No `any` without a comment justifying it. No `eval`. No `dangerouslySetInnerHTML`
  on anything derived from user input.
- Clean `npx tsc --noEmit` before you report done. Warnings from `next lint` on your
  files should be zero.

---

## 11. Definition of done

Report back with: files you created, app ids you registered, anything you needed but
couldn't touch, and confirmation that `npx tsc --noEmit` passes. If you finished
something partially, say so explicitly — the QA agent needs to know what to check.
