# Vendored fonts

These are committed to the repo **on purpose**. `next/font/google` fetches from
`fonts.googleapis.com` at build time, which means `npm run dev` fails outright
with no internet. Self-hosting them is what lets this project run fully offline.

| File | Font | Used for |
| --- | --- | --- |
| `silkscreen-400.woff2` | Silkscreen Regular | UI chrome — menus, title bars, buttons, labels |
| `silkscreen-700.woff2` | Silkscreen Bold | Emphasis in chrome |
| `vt323-400.woff2` | VT323 | The Terminal app and anything monospaced |

Body copy (your bio, project descriptions) deliberately uses a **system** font
stack — Geneva / Verdana / Helvetica — so it needs no download at all and has
full character coverage for accented names.

These files are the **`latin` subset** (U+0000–00FF plus common punctuation),
which is all the English UI chrome needs, and keeps all three files under 14 KB
combined. If you specifically need Latin Extended, Cyrillic or Greek in the
*pixel* font, download the matching subset from Google Fonts and add it to the
`src` array in `app/layout.tsx`.

## Licence

Both fonts are under the **SIL Open Font License 1.1** — full text in `OFL.txt`.

- **Silkscreen** — © The Silkscreen Project Authors,
  https://github.com/googlefonts/silkscreen
- **VT323** — © The VT323 Project Authors,
  https://github.com/phoikoi/VT323

The OFL permits bundling and redistributing these with your own work. Keep
`OFL.txt` next to them if you fork or deploy this.
