/**
 * Terminal: local commands, app launching, and the offline contract.
 *
 * The one server-side surface in the project is POST /api/terminal. With no
 * ANTHROPIC_API_KEY set — the expected state for a fresh clone — it must answer
 * HTTP 200 with `offline: true`, never a 4xx/5xx, so the terminal stays in
 * character out of the box.
 */
import { expect, test } from '@playwright/test';
import { bootToDesktop, openAppFromMenu, runTerminal, windowByTitle } from './helpers';

test('`help` prints the command list', async ({ page }) => {
  await bootToDesktop(page);
  await openAppFromMenu(page, 'Terminal');

  const log = page.getByRole('log', { name: 'Terminal output' });
  // The banner + help block prints on open...
  await expect(log).toContainText('COMMANDS');

  // ...and `help` prints it again on demand.
  await runTerminal(page, 'help');
  await expect(log).toContainText('> help');
  for (const command of ['help', 'ls', 'open <app>', 'clear', 'exit']) {
    await expect(log).toContainText(command);
  }
});

test('`open paint` launches Paint', async ({ page }) => {
  await bootToDesktop(page);
  await openAppFromMenu(page, 'Terminal');

  await runTerminal(page, 'open paint');

  await expect(page.getByRole('log', { name: 'Terminal output' })).toContainText('Launching Paint');
  await expect(windowByTitle(page, /Paint/)).toBeVisible();
});

test('`open nonsense` fails in character without opening anything', async ({ page }) => {
  await bootToDesktop(page);
  await openAppFromMenu(page, 'Terminal');

  const before = await page.locator('[data-window]').count();
  await runTerminal(page, 'open definitely-not-an-app');

  await expect(page.getByRole('log', { name: 'Terminal output' })).toContainText(
    'NO SUCH APPLICATION',
  );
  expect(await page.locator('[data-window]').count()).toBe(before);
});

test('`ls` lists installed applications', async ({ page }) => {
  await bootToDesktop(page);
  await openAppFromMenu(page, 'Terminal');

  await runTerminal(page, 'ls');
  const log = page.getByRole('log', { name: 'Terminal output' });
  await expect(log).toContainText('applications installed');
  await expect(log).toContainText('paint');
  await expect(log).toContainText('terminal');
});

test('POST /api/terminal answers 200 with offline:true when no API key is set', async ({
  request,
}) => {
  const res = await request.post('/api/terminal', {
    data: { input: 'who are you?', history: [] },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.offline).toBe(true);
  expect(typeof body.reply).toBe('string');
  expect(body.reply.length).toBeGreaterThan(0);
  // Nothing key-shaped ever comes back out of the route.
  expect(JSON.stringify(body)).not.toMatch(/sk-ant|ANTHROPIC_API_KEY/i);
});

test('POST /api/terminal rejects an empty input with 400, not a crash', async ({ request }) => {
  const res = await request.post('/api/terminal', { data: { input: '   ' } });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toBe('invalid_input');
});

test('unrecognised input falls through to the assistant and stays in character', async ({
  page,
}) => {
  await bootToDesktop(page);
  await openAppFromMenu(page, 'Terminal');

  await runTerminal(page, 'tell me about yourself');
  const win = windowByTitle(page, /Terminal/);
  await expect(page.getByRole('log', { name: 'Terminal output' })).toContainText(
    '> tell me about yourself',
  );
  // With no API key the route answers offline, and the status bar says so.
  // (The reply text itself lives in content/terminal.ts, so it is not asserted.)
  await expect(win.getByText('Link down')).toBeVisible({ timeout: 20_000 });
});
