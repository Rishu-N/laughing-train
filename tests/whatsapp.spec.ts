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
import { expect, test, type Page } from '@playwright/test';
import { conversations } from '../content/conversations';
import { boot, openAppFromMenu, windowByTitle, closeWindow } from './helpers';

const SAMPLE = conversations[0];
const FIRST_LINE = SAMPLE.messages[0].text;
const LAST_LINE = SAMPLE.messages[SAMPLE.messages.length - 1].text;

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

/** Desktop opens a folder row on double-click; mobile has no such gesture. */
async function openRow(page: Page, pattern: RegExp) {
  const row = downloads(page).getByRole('button', { name: pattern });
  await expect(row).toBeVisible();
  if (test.info().project.name === 'mobile') await row.click();
  else await row.dblclick();
}

/** Downloads → this sample → past the installer → messages on screen. */
async function openSample(page: Page) {
  await boot(page);
  await openAppFromMenu(page, 'Downloads');
  await openRow(page, new RegExp(`${SAMPLE.id}\\.zip`));
  await install(page);
  await expect(chatLog(page).getByText(LAST_LINE, { exact: true })).toBeVisible();
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
