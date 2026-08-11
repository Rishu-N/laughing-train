/**
 * Every registered app opens, mounts and shows up in the dock.
 *
 * The list is read out of the Apps menu, which is generated from
 * lib/os/registry.ts — so adding an app to a manifest (or a project to
 * content/projects.ts) automatically extends this test instead of rotting it.
 */
import { expect, test } from '@playwright/test';
import {
  bootToDesktop,
  closeWindow,
  dockTiles,
  openAppFromMenu,
  registeredAppTitles,
  windows,
} from './helpers';

test('the Apps menu lists every registered app, and each one opens and mounts', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`console: ${msg.text()}`);
  });

  await bootToDesktop(page);

  const titles = await registeredAppTitles(page);
  // Sanity: the registry is not empty and the known core apps are present.
  expect(titles.length).toBeGreaterThanOrEqual(10);
  for (const expected of ['Browser', 'Paint', 'Notes', 'Word', 'Spreadsheet', 'Terminal']) {
    expect(titles).toContain(expected);
  }

  // Start from an empty desktop so each app is measured on its own.
  const browser = page.getByRole('dialog', { name: /^Browser/ });
  await closeWindow(page, browser);
  await expect(windows(page)).toHaveCount(0);

  for (const title of titles) {
    await test.step(`open ${title}`, async () => {
      await openAppFromMenu(page, title);

      await expect(windows(page)).toHaveCount(1);
      const win = windows(page).first();
      await expect(win).toBeVisible();

      // Mounted, not just framed: the content region below the title bar has
      // rendered something. Every app is a dynamic(ssr:false) import with no
      // loading state, so poll rather than sampling the frame it opened on.
      await expect
        .poll(
          async () => (await win.locator('> div').nth(1).innerHTML()).length,
          { message: `${title} never rendered anything into its window body` },
        )
        .toBeGreaterThan(50);

      // In the dock, exactly once, named after whatever title the app settled on.
      await expect(dockTiles(page)).toHaveCount(1);
      const winTitle = await win.getAttribute('aria-label');
      await expect(dockTiles(page).first()).toHaveAttribute(
        'aria-label',
        new RegExp(`^${winTitle!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
      );

      await closeWindow(page, win);
      await expect(windows(page)).toHaveCount(0);
    });
  }

  expect(consoleErrors, `page errors while opening apps:\n${consoleErrors.join('\n')}`).toEqual([]);
});

test('project apps are generated from content/projects.ts', async ({ page }) => {
  await bootToDesktop(page);

  await page.getByRole('button', { name: 'Apps', exact: true }).click();
  const projectGroup = page.getByRole('group', { name: 'Projects' });
  await expect(projectGroup).toBeVisible();
  const count = await projectGroup.getByRole('menuitem').count();
  expect(count).toBeGreaterThan(0);

  // Opening one renders the project window, whose body is entirely data-driven.
  await projectGroup.getByRole('menuitem').first().click();
  await expect(windows(page)).toHaveCount(2);
});
