/**
 * Boot — the first three seconds of the product.
 *
 * The hard requirement the whole project hangs off: the machine boots and the
 * Browser is already open, showing the bio. Everything else is decoration.
 */
import { expect, test } from '@playwright/test';
import {
  bootToDesktop,
  dockTile,
  throughClassicShell,
  windowByTitle,
  windows,
} from './helpers';

test('boot overlay appears and then clears', async ({ page }) => {
  await page.goto('/');
  await throughClassicShell(page);
  await expect(page.getByTestId('boot-sequence')).toBeVisible();
  await page.getByTestId('boot-sequence').waitFor({ state: 'detached', timeout: 15_000 });
  await expect(page.getByTestId('boot-sequence')).toHaveCount(0);
});

test('the classic shell is the front door and hands off to the colour OS', async ({
  page,
}) => {
  await page.goto('/');
  // Every visit starts in 1984 — no skip, by design.
  await expect(page.getByTestId('classic-shell')).toBeVisible();
  await throughClassicShell(page);
  await expect(page.getByTestId('classic-shell')).toHaveCount(0);
  await expect(windowByTitle(page, /^Browser/)).toBeVisible();
});

test('the Browser window is open by default after boot', async ({ page }) => {
  await bootToDesktop(page);

  const browser = windowByTitle(page, /^Browser/);
  await expect(browser).toBeVisible();
  // Exactly one window: the Browser and nothing else.
  await expect(windows(page)).toHaveCount(1);
  // And it is in the dock as a running app.
  await expect(dockTile(page, 'Browser')).toBeVisible();
});

test('the default Browser window renders the bio home page', async ({ page }) => {
  await bootToDesktop(page);
  const browser = windowByTitle(page, /^Browser/);

  // Content comes from content/bio.ts; the test asserts the page STRUCTURE
  // rendered, not the placeholder words, so replacing the bio cannot break it.
  await expect(browser.getByRole('link', { name: /About Me/i }).first()).toBeVisible();
  await expect(browser.getByRole('link', { name: /Skills/i }).first()).toBeVisible();
  await expect(browser.getByRole('link', { name: /Contact/i }).first()).toBeVisible();
});

test('the menu bar exposes the Apps menu and the logo dropdown', async ({ page }) => {
  await bootToDesktop(page);

  await page.getByRole('button', { name: 'Apps', exact: true }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();

  // The logo button's accessible name is built from content/bio.ts.
  const logo = page.getByRole('button', { name: /about and links/i });
  await expect(logo).toBeVisible();
  await logo.click();
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /About This Macintosh/i })).toBeVisible();
});
