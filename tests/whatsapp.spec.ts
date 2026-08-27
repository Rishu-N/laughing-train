/**
 * WhatsApp Simulator + the Downloads folder.
 *
 * The interesting assertion here is not "the window opened" — tests/apps.spec.ts
 * already proves that for every registered app. It is that the sample .zip files
 * written by `npm run samples` survive a real round trip: fetched over HTTP,
 * unzipped, parsed by the same parser a dropped file goes through, and drawn as
 * bubbles carrying the exact words in content/conversations.ts.
 *
 * Every test routes through boot(), which routes through throughClassicShell() —
 * the 1984 screen is the front door.
 *
 * NOTE ON VIRTUALIZATION: the chat view only mounts the rows you can see, and it
 * opens scrolled to the newest message. Asserting on the *last* line is
 * therefore the reliable check; the first line is used deliberately, in the
 * search test, to prove that navigating to a hit actually scrolls it into being.
 */
import { readFile } from 'node:fs/promises';
import { expect, test, type Download, type Page } from '@playwright/test';
import { conversations, type MockConversation } from '../content/conversations';
import { boot, openAppFromMenu, windowByTitle, closeWindow } from './helpers';

const SAMPLE = conversations[0];
const FIRST_LINE = SAMPLE.messages[0].text;
const LAST_LINE = SAMPLE.messages[SAMPLE.messages.length - 1].text;

/**
 * The only sample with a system notice in it — needed to prove the "show
 * system messages" switch reaches the exporters. Found rather than indexed, so
 * reordering content/conversations.ts can't silently make the test vacuous.
 */
const WITH_SYSTEM = conversations.find((c) => c.messages.some((m) => m.from === 'system'))!;

/**
 * Who the chat is with, and therefore what the exporters name their files.
 *
 * Spelled out here rather than imported from lib/samples.ts on purpose: if the
 * app's own derivation drifts, this should disagree with it rather than drift
 * along.
 */
function contactOf(c: MockConversation): string {
  const others = c.participants.filter((p) => p !== c.me);
  return others.length === 1 ? others[0] : c.title.split(/\s+[—–-]\s+/)[0].trim();
}

const simulator = (page: Page) => windowByTitle(page, /WhatsApp/);
const downloads = (page: Page) => windowByTitle(page, /^Downloads/);

/**
 * The message log, as opposed to the whole window.
 *
 * Every line of a conversation appears at least twice: once as a bubble, and
 * again as the one-line preview on its row in the chat list. Asserting message
 * text against the window matches both and trips strict mode, so anything
 * looking for a *message* looks in here.
 */
const chatLog = (page: Page) => simulator(page).getByTestId('whatsapp-chat');

/** The app introduces itself once; get past it. */
async function install(page: Page) {
  const button = simulator(page).getByRole('button', { name: 'Install' });
  await expect(button).toBeVisible();
  await button.click();
}

/**
 * Desktop opens a folder row on double-click; narrow layouts have no such
 * gesture, so a single tap opens.
 *
 * Which one applies is read off the folder's own toolbar rather than the
 * Playwright project name — the label and the click handler come from the same
 * useIsMobile(), so this follows the app even in a test that sets a narrow
 * viewport inside the desktop project.
 */
async function openRow(page: Page, pattern: RegExp) {
  const win = downloads(page);
  const row = win.getByRole('button', { name: pattern });
  await expect(row).toBeVisible();
  if (await win.getByText('Tap to open').isVisible()) await row.click();
  else await row.dblclick();
}

/** Downloads → this sample → past the installer → messages on screen. */
async function openSample(page: Page, conversation: MockConversation = SAMPLE) {
  await boot(page);
  await openAppFromMenu(page, 'Downloads');
  await openRow(page, new RegExp(`${conversation.id}\\.zip`));
  await install(page);
  const last = conversation.messages[conversation.messages.length - 1].text;
  await expect(chatLog(page).getByText(last, { exact: true })).toBeVisible();
}

test.describe('WhatsApp Simulator', () => {
  test('installs once, then opens straight into the app', async ({ page }) => {
    await boot(page);
    await openAppFromMenu(page, 'WhatsApp Simulator');

    const win = simulator(page);
    await expect(win.getByRole('heading', { name: 'WhatsApp Chat Simulator' })).toBeVisible();
    // The promise the installer makes is the reason it exists.
    await expect(win.getByText(/Nothing is uploaded/i)).toBeVisible();

    await install(page);
    await expect(win.getByTestId('whatsapp-empty')).toBeVisible();

    // Second launch in the same session: the answer is remembered.
    await closeWindow(page, win);
    await openAppFromMenu(page, 'WhatsApp Simulator');
    await expect(simulator(page).getByTestId('whatsapp-empty')).toBeVisible();
    await expect(simulator(page).getByRole('button', { name: 'Install' })).toHaveCount(0);
  });

  test('the installer can be summoned again from inside the app', async ({ page }) => {
    await boot(page);
    await openAppFromMenu(page, 'WhatsApp Simulator');
    await install(page);

    const win = simulator(page);
    await win.getByRole('button', { name: 'About' }).click();
    await expect(win.getByRole('heading', { name: 'WhatsApp Chat Simulator' })).toBeVisible();
    await win.getByRole('button', { name: 'Back' }).click();
    await expect(win.getByTestId('whatsapp-empty')).toBeVisible();
  });

  test('lists the sample exports in its own sidebar', async ({ page }) => {
    await boot(page);
    await openAppFromMenu(page, 'WhatsApp Simulator');
    await install(page);

    const win = simulator(page);
    for (const conversation of conversations) {
      await expect(win.getByText(conversation.title, { exact: true })).toBeVisible();
    }
  });

  test('parses in a Web Worker rather than falling back to the main thread', async ({ page }) => {
    // client.ts warns exactly once if it has to give up on the worker. The whole
    // OS freezing on a large import is not something to discover in the wild.
    const warnings: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('Web Worker unavailable')) warnings.push(msg.text());
    });

    await boot(page);
    await openAppFromMenu(page, 'WhatsApp Simulator');
    await install(page);

    const win = simulator(page);
    await win.getByText(SAMPLE.title, { exact: true }).click();
    await expect(chatLog(page).getByText(LAST_LINE, { exact: true })).toBeVisible();

    expect(warnings).toEqual([]);
  });

  test('its palette stops at the edge of the window', async ({ page }) => {
    // whatsapp.css declares --accent, --panel-bg, --divider and friends —
    // names that collide head-on with the System 7 tokens. Every one of them
    // is scoped to `.whatsapp-app`; a stray `:root` would silently restyle the
    // entire operating system, and the OS would still look plausible enough
    // that nobody notices until it's shipped.
    await openSample(page);

    const leaked = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return ['--accent', '--chat-bg', '--bubble-out', '--panel-bg', '--divider', '--text-primary']
        .filter((name) => root.getPropertyValue(name).trim() !== '');
    });
    expect(leaked).toEqual([]);

    // …and they are genuinely defined one level in, so the check above is
    // measuring scope rather than a stylesheet that failed to load.
    const inside = await chatLog(page).evaluate((el) =>
      getComputedStyle(el).getPropertyValue('--bubble-out').trim(),
    );
    expect(inside).not.toBe('');
  });

  test('falls back to the main thread when the worker never loads', async ({ page }) => {
    // The other half of the test above. client.ts degrades to running
    // handler.ts in-page if the worker script fails to arrive — a real
    // possibility (stale chunk after a deploy, a CSP rule) that otherwise only
    // gets exercised by never happening.
    //
    // Stubbing the constructor reproduces the exact shape of that failure:
    // `new Worker(...)` succeeds, handlers get attached, and then onerror
    // fires with nothing ever having been posted back. That is the case the
    // fallback is built around — the request is already in flight when the
    // worker is given up on, so it has to be replayed locally.
    await page.addInitScript(() => {
      class DeadWorker extends EventTarget {
        onmessage: ((ev: MessageEvent) => void) | null = null;
        onerror: ((ev: { message: string }) => void) | null = null;
        constructor() {
          super();
          setTimeout(() => this.onerror?.({ message: 'forced by test' }), 0);
        }
        postMessage() {}
        terminate() {}
      }
      (window as unknown as { Worker: unknown }).Worker = DeadWorker;
    });

    const warnings: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('Web Worker unavailable')) warnings.push(msg.text());
    });

    await openSample(page);

    // The import completed anyway — same parser, same protocol, same bubbles.
    await expect(simulator(page).getByTestId('whatsapp-chat-meta')).toContainText(
      `${SAMPLE.messages.length} messages`,
    );
    // Search runs through the same client, so it proves the local handler kept
    // its index rather than merely answering the one request.
    await simulator(page).getByRole('button', { name: 'Find in chat' }).click();
    await simulator(page)
      .getByRole('searchbox', { name: 'Search in this chat' })
      .fill(FIRST_LINE.slice(0, 14));
    await expect(chatLog(page).getByText(FIRST_LINE, { exact: true })).toBeVisible();

    // Exactly once — degrade() is idempotent, and a warning per request would
    // mean it isn't.
    expect(warnings).toHaveLength(1);
  });
});

test.describe('Downloads', () => {
  test('lists every sample export with a real file size', async ({ page }) => {
    await boot(page);
    await openAppFromMenu(page, 'Downloads');

    const win = downloads(page);
    await expect(win.getByTestId('downloads-list').getByRole('listitem')).toHaveCount(
      conversations.length,
    );
    for (const conversation of conversations) {
      await expect(win.getByText(`${conversation.id}.zip`, { exact: true })).toBeVisible();
      await expect(win.getByText(conversation.blurb, { exact: true })).toBeVisible();
    }
    // An em dash in every size column would mean the .zip files were never
    // generated — the listing would be furniture rather than a folder.
    await expect(win.getByText(/^(\d+K|\d+ bytes)$/).first()).toBeVisible();
  });

  test('opening a sample loads that chat into the simulator', async ({ page }) => {
    await openSample(page);
    // The words came out of content/conversations.ts, went into a real .zip and
    // came back through the parser.
    await expect(simulator(page).getByTestId('whatsapp-chat-meta')).toContainText(
      `${SAMPLE.messages.length} messages`,
    );
    // The window renamed itself after whoever the export says the chat is with.
    await expect(windowByTitle(page, /WhatsApp — /)).toBeVisible();
  });

  test('narrowing the date range changes what the chat shows', async ({ page }) => {
    await openSample(page);
    const win = simulator(page);
    const meta = win.getByTestId('whatsapp-chat-meta');
    await expect(meta).toContainText(`${SAMPLE.messages.length} messages`);

    await win.getByRole('button', { name: 'Filters and settings' }).click();
    await win.getByRole('button', { name: 'Last 7 days' }).click();

    await expect(meta).toContainText('filtered');
    await expect(meta).not.toContainText(`${SAMPLE.messages.length} messages`);

    await win.getByRole('button', { name: 'All time' }).click();
    await expect(meta).toContainText(`${SAMPLE.messages.length} messages`);
    await expect(meta).not.toContainText('filtered');
  });

  test('searching inside a chat reports its hits and scrolls to them', async ({ page }) => {
    await openSample(page);
    const win = simulator(page);

    await win.getByRole('button', { name: 'Find in chat' }).click();
    const field = win.getByRole('searchbox', { name: 'Search in this chat' });
    await field.fill(FIRST_LINE.slice(0, 14));

    await expect(win.getByText(/^\d+ \/ \d+$/)).toBeVisible();
    // The hit is the very first message of the conversation, which was not in
    // the DOM a moment ago — jumping to it is the observable behaviour.
    await expect(chatLog(page).getByText(FIRST_LINE, { exact: true })).toBeVisible();

    await field.fill('zzzzzzzz-no-such-message');
    await expect(win.getByText('No results')).toBeVisible();
  });
});

/**
 * The exporters.
 *
 * "A chat you can keep" is the whole reason this app exists, so these assert on
 * the bytes that reach the disk, not on the dialog saying it finished. Each one
 * drives the real sheet, waits for a real download, and reads the file back.
 *
 * The HTML export is checked hardest because it is the only one whose output is
 * legible: it is a single self-contained document, so the words from
 * content/conversations.ts can be found inside it. PDF and PNG are opaque
 * containers — for those, a magic number and a plausible byte count are the
 * honest limit of what a black-box test can claim.
 */
test.describe('Export', () => {
  /** Open the export sheet on whatever chat is loaded and pick a format. */
  async function exportAs(page: Page, format: RegExp): Promise<Download> {
    const win = simulator(page);
    await win.getByRole('button', { name: 'Export chat' }).click();

    const sheet = win.getByRole('alertdialog', { name: 'Export chat' });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('radio', { name: format }).check();

    // Arm the listener before the click: pdf-lib is a dynamic import, but a
    // small chat can still finish rendering before an await would resume.
    const download = page.waitForEvent('download');
    await sheet.getByRole('button', { name: 'Export', exact: true }).click();
    const file = await download;
    // The sheet shows "Downloaded." and dismisses itself on a timer. Waiting
    // it out here means a second export in the same test can't click Export on
    // a dialog that is about to close underneath it.
    await expect(sheet).toBeHidden();
    return file;
  }

  /** Bytes as they landed on disk. */
  async function bytesOf(download: Download): Promise<Buffer> {
    const path = await download.path();
    expect(path).toBeTruthy();
    return readFile(path!);
  }

  test('writes a self-contained HTML file carrying the real conversation', async ({ page }) => {
    await openSample(page);
    const download = await exportAs(page, /Web page/);
    expect(download.suggestedFilename()).toBe(`${contactOf(SAMPLE)}.html`);

    const html = (await bytesOf(download)).toString('utf8');
    expect(html.startsWith('<!doctype html>')).toBe(true);

    // The message text is embedded as JSON, so it appears escaped exactly the
    // way buildDocument() writes it — including the `<` → < guard that
    // stops a message body breaking out of the <script> block.
    const embedded = (text: string) => JSON.stringify(text).slice(1, -1).replace(/</g, '\\u003c');
    expect(html).toContain(embedded(FIRST_LINE));
    expect(html).toContain(embedded(LAST_LINE));
    expect(html).toContain(embedded(contactOf(SAMPLE)));

    // "Self-contained" is the promise on the radio button. A file that reaches
    // for a stylesheet or a script is a file that breaks on a plane.
    expect(html).not.toMatch(/<script[^>]+\bsrc=/i);
    expect(html).not.toMatch(/<link\b/i);
    // No attribute anywhere points off the file. (The embedded script does
    // contain `<img … src="` as a string it assembles at runtime, so matching
    // on the tag would be a false positive; matching on an absolute URL is
    // the thing actually worth forbidding.)
    expect(html).not.toMatch(/\b(?:src|href)\s*=\s*"(?:https?:)?\/\//i);
  });

  test('writes a real PDF', async ({ page }) => {
    await openSample(page);
    const download = await exportAs(page, /^PDF/);
    expect(download.suggestedFilename()).toBe(`${contactOf(SAMPLE)}.pdf`);

    const bytes = await bytesOf(download);
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    // A page of JPEG-compressed bubbles is tens of KB; anything under 5 KB
    // means the canvas painted nothing and the pages came out blank.
    expect(bytes.byteLength).toBeGreaterThan(5_000);
    // pdf-lib writes the trailer last, so its presence means save() completed.
    expect(bytes.subarray(-1024).toString('latin1')).toContain('%%EOF');
  });

  test('writes a single PNG for a chat that fits one canvas', async ({ page }) => {
    await openSample(page);
    const download = await exportAs(page, /Image/);
    // Past the canvas-height cap the exporter zips numbered parts instead. A
    // sample this short must take the ordinary single-image path.
    expect(download.suggestedFilename()).toBe(`${contactOf(SAMPLE)}.png`);

    const bytes = await bytesOf(download);
    expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(bytes.byteLength).toBeGreaterThan(5_000);
  });

  test('exports only the filtered range, and says so before it starts', async ({ page }) => {
    await openSample(page);
    const win = simulator(page);

    await win.getByRole('button', { name: 'Filters and settings' }).click();
    await win.getByRole('button', { name: 'Last 7 days' }).click();
    await expect(win.getByTestId('whatsapp-chat-meta')).toContainText('filtered');
    await win.getByRole('button', { name: 'Filters and settings' }).click();

    await win.getByRole('button', { name: 'Export chat' }).click();
    const sheet = win.getByRole('alertdialog', { name: 'Export chat' });
    await expect(sheet).toContainText('(filtered range)');
    await sheet.getByRole('radio', { name: /Web page/ }).check();

    const download = page.waitForEvent('download');
    await sheet.getByRole('button', { name: 'Export', exact: true }).click();
    const html = (await bytesOf(await download)).toString('utf8');

    // The first message is weeks outside a 7-day window; the last is inside it.
    const embedded = (text: string) => JSON.stringify(text).slice(1, -1).replace(/</g, '\\u003c');
    expect(html).toContain(embedded(LAST_LINE));
    expect(html).not.toContain(embedded(FIRST_LINE));
  });

  test('hiding system messages hides them from the export too', async ({ page }) => {
    // What you see is what you keep. The switch filters the live chat; an
    // export that quietly puts the notices back would be a different document
    // from the one on screen.
    await openSample(page, WITH_SYSTEM);
    const win = simulator(page);
    const notice = WITH_SYSTEM.messages.find((m) => m.from === 'system')!.text;
    const embedded = (text: string) => JSON.stringify(text).slice(1, -1).replace(/</g, '\\u003c');

    const withNotice = await bytesOf(await exportAs(page, /Web page/));
    expect(withNotice.toString('utf8')).toContain(embedded(notice));

    await win.getByRole('button', { name: 'Filters and settings' }).click();
    await win.getByRole('checkbox', { name: /Show system messages/ }).uncheck();
    await win.getByRole('button', { name: 'Filters and settings' }).click();

    const html = (await bytesOf(await exportAs(page, /Web page/))).toString('utf8');
    expect(html).not.toContain(embedded(notice));
    // …and the rest of the conversation still came through.
    const last = WITH_SYSTEM.messages[WITH_SYSTEM.messages.length - 1].text;
    expect(html).toContain(embedded(last));
  });
});

/*
 * Stored chats and their media.
 *
 * These reach into IndexedDB with the raw API rather than the app's own
 * wrapper, deliberately: a test that asks lib/store/db.ts whether db.ts did the
 * right thing proves nothing.
 */
const DB_NAME = 'whatsapp-simulator';

/** Media rows the store holds for one chat. */
function mediaCount(page: Page, chatId: string): Promise<number> {
  return page.evaluate(
    async ([name, id]) => {
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        const req = indexedDB.open(name);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      try {
        return await new Promise<number>((resolve, reject) => {
          const req = db
            .transaction('media')
            .objectStore('media')
            .index('byChatId')
            .count(IDBKeyRange.only(id));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      } finally {
        db.close();
      }
    },
    [DB_NAME, chatId] as const,
  );
}

/** Write a chat row straight into the store, the way a partial import would. */
function putChatRecord(page: Page, record: Record<string, unknown>): Promise<void> {
  return page.evaluate(
    async ([name, value]) => {
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        const req = indexedDB.open(name as string);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('chats', 'readwrite');
          tx.objectStore('chats').put(value);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } finally {
        db.close();
      }
    },
    [DB_NAME, record] as const,
  );
}

/** A media row for a chat. The Blob is built in the page — it cannot cross
 *  the evaluate boundary as an argument. */
function seedMediaRow(page: Page, chatId: string, filename: string): Promise<void> {
  return page.evaluate(
    async ([name, id, file]) => {
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        const req = indexedDB.open(name);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('media', 'readwrite');
          tx.objectStore('media').put({
            key: `${id}::${file}`,
            chatId: id,
            filename: file,
            blob: new Blob(['not really a jpeg'], { type: 'image/jpeg' }),
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } finally {
        db.close();
      }
    },
    [DB_NAME, chatId, filename] as const,
  );
}

test.describe('Stored chats', () => {
  const CHAT_ID = `sample:${SAMPLE.id}`;

  /**
   * The chat list is a drawer when the app was opened straight onto a chat.
   *
   * `exact` is load-bearing on the toolbar button: role names match on a
   * substring, and once the drawer is open there are two "Close chat list"
   * controls on screen for "Chat list" to collide with.
   */
  async function showChatList(page: Page) {
    const list = simulator(page).getByRole('complementary', { name: 'Chat history' });
    if (!(await list.isVisible())) {
      await simulator(page).getByRole('button', { name: 'Chat list', exact: true }).click();
    }
    await expect(list).toBeVisible();
    return list;
  }

  test('removing a chat deletes its media with it', async ({ page }) => {
    await openSample(page);

    // The shipped samples are text-only, so nothing would be observably freed
    // otherwise. This seeds a blob keyed to the chat exactly as an import
    // would; what is under test is the cursor sweep in deleteChat(), not how
    // the blob got there.
    await seedMediaRow(page, CHAT_ID, 'IMG-0001.jpg');
    expect(await mediaCount(page, CHAT_ID)).toBe(1);

    const list = await showChatList(page);
    await list.getByRole('button', { name: `Delete ${contactOf(SAMPLE)}` }).click();
    await simulator(page).getByRole('button', { name: 'Remove' }).click();

    await expect(simulator(page).getByTestId('whatsapp-empty')).toBeVisible();
    expect(await mediaCount(page, CHAT_ID)).toBe(0);

    // And it is really gone, not just gone from this render.
    await boot(page);
    await openAppFromMenu(page, 'WhatsApp Simulator');
    await expect(simulator(page).getByText('No chats imported yet.')).toBeVisible();
  });

  test('a half-written record cannot wedge the app', async ({ page }) => {
    await openSample(page);

    // A save interrupted mid-transaction: an id and nothing else. Rendering
    // `undefined.toLocaleString()` would throw during render, and with no error
    // boundary between a chat row and the desktop that takes the whole OS down
    // — on this load and on every load after it, since the record is still
    // there. The app has to survive its own storage.
    await putChatRecord(page, { id: 'sample:interrupted' });

    await boot(page);
    await openAppFromMenu(page, 'WhatsApp Simulator');
    const win = simulator(page);

    // Still an operating system, still an app inside it.
    await expect(win.getByTestId('whatsapp-empty')).toBeVisible();
    // The broken record shows as a placeholder rather than taking the good one
    // with it.
    await expect(win.getByText('Untitled chat', { exact: true })).toBeVisible();
    await expect(win.getByText(contactOf(SAMPLE), { exact: true })).toBeVisible();
  });
});

test.describe('At 375px', () => {
  // The narrowest width the design system commits to. The sidebar, the
  // settings drawer, the search bar and the export sheet are the four things
  // in this app that were `position: fixed` in the standalone build, so they
  // are the four most likely to push the page sideways.
  test.use({ viewport: { width: 375, height: 700 } });

  const overflow = (page: Page) =>
    page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  test('nothing in the app pushes the page sideways', async ({ page }) => {
    await openSample(page);
    const win = simulator(page);
    expect(await overflow(page)).toBeLessThanOrEqual(1);

    await win.getByRole('button', { name: 'Chat list', exact: true }).click();
    await expect(win.getByRole('complementary', { name: 'Chat history' })).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(1);
    await win.getByRole('button', { name: 'Chat list', exact: true }).click();

    await win.getByRole('button', { name: 'Find in chat' }).click();
    await win.getByRole('searchbox', { name: 'Search in this chat' }).fill('the');
    expect(await overflow(page)).toBeLessThanOrEqual(1);
    await win.getByRole('button', { name: 'Find in chat' }).click();

    await win.getByRole('button', { name: 'Filters and settings' }).click();
    await expect(win.getByRole('heading', { name: 'Settings' })).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(1);
    await win.getByRole('button', { name: 'Filters and settings' }).click();

    await win.getByRole('button', { name: 'Export chat' }).click();
    const sheet = win.getByRole('alertdialog', { name: 'Export chat' });
    await expect(sheet).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(1);
    // The sheet is 380px wide by default — wider than the screen — so this is
    // the one that has to be clamped rather than merely tidy.
    const box = await sheet.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  });
});
