# `content/` — everything you actually write

This folder is the whole editable surface of the site. **Every word a visitor
reads about you lives in here**, and no component embeds any of it. If you only
ever open one folder in this repo, open this one.

Two rules:

1. **Edit values, never keys.** The shapes are enforced by `content/types.ts`,
   which is frozen. Deleting a required key is a TypeScript error; deleting an
   optional one just hides that piece of UI.
2. **Never edit a component to change copy.** If some text is wrong and you
   can't find it in here, that's a bug — report it rather than patching the
   component, because the next content update will undo your patch.

After editing, `npx tsc --noEmit` tells you instantly if you lost a comma.

---

## The files

| File | Holds | Frozen? |
| --- | --- | --- |
| `bio.ts` | Everything about you: name, tagline, about, skills, socials | edit freely |
| `projects.ts` | `Project[]` — **one entry = one app in the OS** | edit freely |
| `facts.ts` | `Fact[]` — the personal facts Fact-sweeper reveals | edit freely |
| `terminal.ts` | The Terminal assistant's banner, voice and offline lines | edit freely |
| `images.ts` | Image paths, one slot per image | frozen (swap files instead) |
| `types.ts` | The schemas for all of the above | frozen |

---

## `bio.ts` — `Bio`

Rendered by the Browser app (the window that opens on boot), the menu-bar logo
dropdown, the About box, and injected into the Terminal assistant as context.

| Field | Required | Where it shows up |
| --- | --- | --- |
| `name` | yes | Browser headline, menu-bar dropdown heading, About box, `whoami` |
| `tagline` | yes | Italic line under the name; About box subtitle |
| `location` | no | Browser home info panel, Contact page, About box |
| `status` | no | Browser home "Currently"; About box; `whoami` |
| `about` | yes | Browser About page — one array entry per paragraph |
| `skills` | yes | Browser Skills page (two columns); `about` command |
| `socials` | yes (`[]` allowed) | Browser Links page and the menu-bar dropdown |
| `email` | no | Browser Contact page + menu dropdown, as a real `mailto:` |
| `nowPlaying` | no | The boxed "Right now" sidebar on the Browser home page |

`socials[]` entries are `{ label, url, handle? }`. `url` must include
`https://` or the link will not work.

## `projects.ts` — `Project[]`

**One array entry becomes one app.** `lib/apps/projects.apps.ts` maps over this
array and generates an `AppDefinition` per entry, all backed by the same
`ProjectApp` component. Adding a project means adding an object here — no new
file, no component change, no registry edit. The app appears in the Apps menu,
in the dock when open, and can be launched from the Terminal with `open <id>`.

| Field | Required | Used for |
| --- | --- | --- |
| `id` | yes | The app id. kebab-case, unique, typeable — it is what `open <id>` accepts |
| `title` | yes | Window title bar, dock tile, Apps menu row |
| `blurb` | yes | One-line summary in the window header, `ls` and `projects` |
| `description` | yes | Body copy — one array entry per paragraph |
| `language` | yes | Shown in the header, and picks the app icon (`iconForLanguage`) |
| `tech` | yes (`[]` allowed) | The chip row under the description |
| `links` | yes (`[]` allowed) | `{ label, url }` — repo / demo / writeup buttons |
| `screenshot` | yes | Image path; use `projectScreenshot(n)` from `content/images.ts` |
| `year` | yes | Header, e.g. `"2024"` or `"2023–24"` |
| `status` | no | Small chip, e.g. `"shipped"`, `"archived"`, `"in progress"` |

## `facts.ts` — `Fact[]`

The payload of Fact-sweeper: each cleared sector recovers one fact into the
Dossier, which persists in the visitor's browser. Currently **51** placeholder
facts (22 common / 19 uncommon / 10 rare).

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | kebab-case, unique and **permanent** — it is the "already recovered" key |
| `label` | yes | Left column in the Dossier. 1–3 words |
| `value` | yes | Right column and the big RECOVERED readout. One line, ~20–60 chars |
| `category` | yes | `basics` · `work` · `interests` · `trivia` · `opinions` — Dossier sections |
| `rarity` | yes | **The game mechanic.** `common` = any board · `uncommon` = Medium+ · `rare` = Hard only |

Renaming an `id` makes returning visitors lose that fact from their Dossier;
rewriting `label`/`value` is free. Aim for 40+ facts or the Hard board runs dry.

## `terminal.ts` — `TerminalPersona`

| Field | Required | Notes |
| --- | --- | --- |
| `banner` | yes | Printed when the Terminal opens. Keep lines under ~38 chars so they fit at 375px |
| `systemPrompt` | yes | **Voice and rules only.** Your bio and projects are appended automatically by the API route — do not restate facts here |
| `offlineReplies` | yes | Used when no `ANTHROPIC_API_KEY` is set, and whenever the upstream call fails. One is picked at random |

`systemPrompt` is used **server-side only** and is tree-shaken out of the client
bundle; `banner` and `offlineReplies` ship to the browser.

## `images.ts` — frozen paths

Don't edit this file to change a picture. Drop your file into the matching
folder under `public/images/` **using the same filename** and it appears
everywhere that slot is used. Only rename the string here if you'd rather keep
your own filename.

| Export | Points at |
| --- | --- |
| `SYSTEM_IMAGES` | `logo` (menu bar), `bootMark` (colour-OS boot screen), `desktopPattern` (wallpaper) |
| `BRAND_IMAGES` | `classicMark` (1984 boot screen), `rishuInc` (the wordmark that resolves after the Software Update), `classicPortrait` (32×32 1-bit bust) |
| `APP_ICONS` | One 32×32 icon per app id, plus the project icon variants |
| `SELF_PORTRAIT` | The pixel bust preloaded into Paint and shown on the Browser home page |
| `PROJECT_SCREENSHOTS` / `projectScreenshot(n)` | `project-0N-screenshot.png`, one per project |
| `iconForLanguage(language)` | Picks a project icon from `Project.language` |

The `BRAND_IMAGES` marks and the two `SYSTEM_IMAGES` marks are generated by
`npm run brand` (`scripts/generate-brand.mjs`) — edit the character maps there
rather than hand-editing the SVGs, or the next run will overwrite you. Everything
else comes from `npm run placeholders`. The two scripts write disjoint files, so
they can be run in any order.

See `public/images/README.md` for the folder layout and expected filenames.
