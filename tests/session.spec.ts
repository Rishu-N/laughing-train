/**
 * Resume-last-session round trips for the three document apps.
 *
 * Each one is the same shape: type, reload the whole page (a cold boot — window
 * layout is deliberately NOT persisted, only documents are), assert the content
 * came back, then use "New" and assert it cleared.
 */
import { expect, test } from '@playwright/test';
import { bootToDesktop, openAppFromMenu, windowByTitle } from './helpers';

/** "New" always sits behind a ConfirmDialog; this clicks through both. */
async function clickNewAndConfirm(page: import('@playwright/test').Page, win: import('@playwright/test').Locator) {
  await win.getByRole('button', { name: 'New', exact: true }).click();
  const dialog = win.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'New', exact: true }).click();
  await expect(dialog).toBeHidden();
}

test('Notes resumes its document after a reload, and New clears it', async ({ page }) => {
  const sample = 'Playwright note ' + Date.now();

  await bootToDesktop(page);
  await openAppFromMenu(page, 'Notes');

  const editor = page.getByRole('textbox', { name: 'Note text' });
  await editor.click();
  await editor.fill(sample);
  await expect(editor).toHaveValue(sample);
  // The session write is debounced (250ms) and flushed on hide/unmount.
  await page.waitForTimeout(600);

  await bootToDesktop(page);
  await openAppFromMenu(page, 'Notes');
  const restored = page.getByRole('textbox', { name: 'Note text' });
  await expect(restored).toHaveValue(sample);

  const win = windowByTitle(page, new RegExp(sample.slice(0, 20)));
  await clickNewAndConfirm(page, win);
  await expect(page.getByRole('textbox', { name: 'Note text' })).toHaveValue('');
});

test('Word resumes its document after a reload, and New clears it', async ({ page }) => {
  const sample = 'Playwright memo ' + Date.now();

  await bootToDesktop(page);
  await openAppFromMenu(page, 'Word');

  const doc = page.getByRole('textbox', { name: 'Document' });
  await doc.click();
  await page.keyboard.type(sample);
  await expect(doc).toContainText(sample);
  await page.waitForTimeout(600);

  await bootToDesktop(page);
  await openAppFromMenu(page, 'Word');
  await expect(page.getByRole('textbox', { name: 'Document' })).toContainText(sample);

  const win = windowByTitle(page, 'Untitled');
  await clickNewAndConfirm(page, win);
  await expect(page.getByRole('textbox', { name: 'Document' })).not.toContainText(sample);
});

test('Spreadsheet resumes its cells after a reload, and New clears them', async ({ page }) => {
  const sample = 'PW' + (Date.now() % 100000);

  await bootToDesktop(page);
  await openAppFromMenu(page, 'Spreadsheet');

  const formulaBar = page.getByRole('textbox', { name: /^Contents of / });
  await formulaBar.click();
  await formulaBar.fill(sample);
  await formulaBar.press('Enter');
  await expect(page.getByText(sample, { exact: true }).first()).toBeVisible();
  await page.waitForTimeout(600);

  await bootToDesktop(page);
  await openAppFromMenu(page, 'Spreadsheet');
  await expect(page.getByText(sample, { exact: true }).first()).toBeVisible();

  const win = windowByTitle(page, 'Untitled');
  await clickNewAndConfirm(page, win);
  await expect(page.getByText(sample, { exact: true })).toHaveCount(0);
});
