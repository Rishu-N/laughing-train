/**
 * Fact-sweeper — the Dossier is the point of the game, so the thing worth
 * testing is that a recovered fact survives a full page reload.
 *
 * The dossier persists through lib/os/persist (key `factsweeper`), and losing a
 * board must never empty it.
 */
import { expect, test, type Locator } from '@playwright/test';
import { bootToDesktop, openAppFromMenu, windowByTitle } from './helpers';

test.beforeEach(async ({ isMobile }) => {
  test.skip(Boolean(isMobile), 'The dossier rail is collapsed behind a toggle on narrow screens');
});

/** "3 / 47 recovered" → 3 */
async function recoveredCount(win: Locator): Promise<number> {
  const text = await win.getByText(/\d+ \/ \d+ recovered/).innerText();
  return Number(text.split('/')[0].trim());
}

/**
 * Clear sectors until at least one fact lands in the dossier. The first click
 * is always safe, but a board can end the run early, so keep trying cells.
 */
async function recoverAFact(win: Locator): Promise<number> {
  await expect(win.getByRole('grid', { name: 'Disk recovery grid' })).toBeVisible();
  const cells = win.getByRole('gridcell');
  await expect.poll(() => cells.count()).toBeGreaterThan(0);
  const total = await cells.count();

  for (let i = 0; i < total; i += 7) {
    await cells.nth(i).click();
    // The draw commits to session storage a render later than the click.
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const n = await recoveredCount(win);
      if (n > 0) return n;
      await win.page().waitForTimeout(100);
    }
  }
  return 0;
}

test('a recovered fact survives a reload and stays in the Dossier', async ({ page }) => {
  await bootToDesktop(page);
  await openAppFromMenu(page, 'Fact-sweeper');

  const win = windowByTitle(page, /Fact-sweeper/);
  await expect(win).toBeVisible();
  expect(await recoveredCount(win)).toBe(0);

  const recovered = await recoverAFact(win);
  expect(recovered, 'clearing the board recovered no facts at all').toBeGreaterThan(0);

  // The first fact's label, as filed in the dossier. Content-agnostic: whatever
  // content/facts.ts says, the same record must come back.
  const filed = (await win.locator('section li').first().innerText()).trim();
  expect(filed.length).toBeGreaterThan(0);

  // Cold boot the whole OS.
  await bootToDesktop(page);
  await openAppFromMenu(page, 'Fact-sweeper');
  const reopened = windowByTitle(page, /Fact-sweeper/);

  expect(await recoveredCount(reopened)).toBe(recovered);
  await expect(reopened.locator('section li')).toContainText([filed.split('\n')[0]]);
});

test('starting a new disk resets the board but not the Dossier', async ({ page }) => {
  await bootToDesktop(page);
  await openAppFromMenu(page, 'Fact-sweeper');
  const win = windowByTitle(page, /Fact-sweeper/);

  const recovered = await recoverAFact(win);
  expect(recovered).toBeGreaterThan(0);

  await win.getByRole('button', { name: 'New Disk' }).click();
  expect(await recoveredCount(win)).toBe(recovered);
});
