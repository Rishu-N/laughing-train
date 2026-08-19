/**
 * BitPaint and BitWrite — the two applications on the 1984 startup disk.
 *
 * These are the only specs in the suite that must NOT call
 * throughClassicShell(). That helper exists to get *past* the black-and-white
 * screen; these apps live *on* it, so every test here runs while
 * [data-testid="classic-shell"] is still up.
 *
 * The other trap is the Software Update notice. It drops in at 2.8s in the
 * top-left corner, on the layer above the windows, and it will silently eat
 * clicks aimed at anything underneath it. dismissNotice() takes it off screen
 * before any window is driven.
 */
import { expect, test, type Page } from '@playwright/test';

/**
 * These specs navigate more than most, and the dev server compiles routes on
 * demand, so the default per-test budget is tight here.
 */
test.describe.configure({ timeout: 90_000 });

/** Land on the 1984 shell and get the update notice out of the way. */
async function classicDesktop(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('classic-shell')).toBeVisible();

  // The notice is on a 2.8s timer that cannot start until the shell has
  // mounted, and a cold Turbopack compile pushes that out a long way — measured
  // at 14s on the first hit after a server start, against ~3s once warm. This
  // waits for the real thing rather than assuming a duration, because a notice
  // that arrives *after* we move on would silently eat the next click: it sits
  // in the top-left corner, on the layer above the windows.
  const later = page.getByRole('button', { name: 'Later', exact: true });
  await later.waitFor({ state: 'visible', timeout: 45_000 });
  await later.click();
  await expect(page.getByTestId('software-update-action')).toHaveCount(0);
}

/** Open the startup disk and launch one of the two applications from it. */
async function launch(page: Page, title: 'BitPaint' | 'BitWrite'): Promise<void> {
  await page.getByRole('button', { name: 'Startup Disk' }).click();
  const disk = page.locator('[data-classic-window="Startup Disk"]');
  await expect(disk).toBeVisible();
  await disk.getByRole('button', { name: title }).click();
  await expect(page.locator(`[data-classic-window="${title}"]`)).toBeVisible();
}

/** Fraction of the canvas that is not paper-white. */
async function inkCoverage(page: Page): Promise<number> {
  return page.getByTestId('paint-canvas').evaluate((el) => {
    const canvas = el as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return -1;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let dark = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 128) dark += 1;
    }
    return dark / (data.length / 4);
  });
}

test.describe('the 1984 applications', () => {
  // Pay the cold-compile cost once, up front, instead of charging it to
  // whichever test happens to run first.
  test.beforeAll(async ({ request }) => {
    await request.get('/');
  });

  test('the startup disk lists applications separately from desk accessories', async ({
    page,
  }) => {
    await classicDesktop(page);
    await page.getByRole('button', { name: 'Startup Disk' }).click();

    const disk = page.locator('[data-classic-window="Startup Disk"]');
    await expect(disk).toBeVisible();
    await expect(disk.getByRole('group', { name: 'Applications' })).toBeVisible();
    await expect(disk.getByRole('button', { name: 'BitPaint' })).toBeVisible();
    await expect(disk.getByRole('button', { name: 'BitWrite' })).toBeVisible();
  });

  test('applications are absent from the mark menu, which lists only accessories', async ({
    page,
  }) => {
    await classicDesktop(page);
    await page.getByRole('menuitem', { name: 'System menu' }).click();

    // A desk accessory is there…
    await expect(page.getByRole('menuitem', { name: 'Calculator' })).toBeVisible();
    // …and the applications deliberately are not. That split is the whole
    // reason AccessoryDef.inDeskMenu exists.
    await expect(page.getByRole('menuitem', { name: 'BitPaint' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'BitWrite' })).toHaveCount(0);
  });

  test('BitPaint draws on the canvas', async ({ page }) => {
    await classicDesktop(page);
    await launch(page, 'BitPaint');

    const canvas = page.getByTestId('paint-canvas');
    await expect(canvas).toBeVisible();
    expect(await inkCoverage(page), 'canvas should start blank').toBe(0);

    const box = await canvas.boundingBox();
    if (!box) throw new Error('paint canvas has no box');

    await page.getByTestId('paint-tool-pencil').click();
    await page.mouse.move(box.x + 30, box.y + 30);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + 90, { steps: 12 });
    await page.mouse.up();

    expect(await inkCoverage(page), 'the stroke should have left ink').toBeGreaterThan(0);
  });

  test('BitPaint selects a tool and inverts it, and the bucket floods with a pattern', async ({
    page,
  }) => {
    await classicDesktop(page);
    await launch(page, 'BitPaint');

    const bucket = page.getByTestId('paint-tool-bucket');
    await bucket.click();
    // The original showed the current tool by inverting its tile; aria-pressed
    // is how that state is exposed to anything that cannot see the inversion.
    await expect(bucket).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('paint-tool-pencil')).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    // 'checker' is the 50% dither this machine uses wherever a lesser screen
    // would reach for grey — there is no solid black in the palette.
    await page.getByTestId('paint-pattern-checker').click();
    const canvas = page.getByTestId('paint-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('paint canvas has no box');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    // Flooding blank paper with a 50% dither lands near half the pixels; well
    // clear of the zero it would be if the bucket did nothing.
    expect(await inkCoverage(page)).toBeGreaterThan(0.2);
  });

  test('BitPaint keeps its picture across a reload', async ({ page }) => {
    await classicDesktop(page);
    await launch(page, 'BitPaint');

    const box = await page.getByTestId('paint-canvas').boundingBox();
    if (!box) throw new Error('paint canvas has no box');
    await page.getByTestId('paint-tool-pencil').click();
    await page.mouse.move(box.x + 40, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + 140, box.y + 100, { steps: 12 });
    await page.mouse.up();

    const before = await inkCoverage(page);
    expect(before).toBeGreaterThan(0);

    // The session write is debounced, so give it a beat to land.
    await page.waitForTimeout(600);
    await classicDesktop(page);
    await launch(page, 'BitPaint');

    expect(await inkCoverage(page)).toBeCloseTo(before, 3);
  });

  test('BitWrite accepts typing and applies a character style', async ({ page }) => {
    await classicDesktop(page);
    await launch(page, 'BitWrite');

    const editor = page.getByTestId('write-editor');
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.type('The quick brown fox');
    await expect(editor).toContainText('The quick brown fox');

    await page.keyboard.press('ControlOrMeta+a');
    await page.getByTestId('write-bold').click();

    await expect(page.getByTestId('write-bold')).toHaveAttribute('aria-pressed', 'true');
    // Asserted on computed weight rather than on a <b> tag: the editor runs
    // execCommand with styleWithCSS on (lib/classic/write.ts), so bold arrives
    // as an inline font-weight and a tag-name assertion would test the browser's
    // choice of markup rather than whether the text is actually bold.
    const bolded = await editor.evaluate((el) =>
      [...el.querySelectorAll('*')].some((n) => {
        const w = getComputedStyle(n as HTMLElement).fontWeight;
        return w === 'bold' || Number(w) >= 600;
      }),
    );
    expect(bolded, 'the selection should render bold').toBe(true);
  });

  test('BitWrite has a working ruler, not a decorative one', async ({ page }) => {
    await classicDesktop(page);
    await launch(page, 'BitWrite');

    const ruler = page.getByTestId('write-ruler');
    await expect(ruler).toBeVisible();

    const marker = page.getByTestId('write-marker-left');
    const start = await marker.boundingBox();
    const track = await ruler.boundingBox();
    if (!start || !track) throw new Error('ruler has no box');

    // Drag the left indent marker along the ruler. The colour OS's Word app has
    // a ruler that only looks draggable (HANDOFF §18); this one has to move.
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(start.x + start.width / 2 + 60, start.y + start.height / 2, {
      steps: 10,
    });
    await page.mouse.up();

    const end = await marker.boundingBox();
    if (!end) throw new Error('marker vanished mid-drag');
    expect(end.x, 'the indent marker should have moved').toBeGreaterThan(start.x + 10);
  });

  test('BitWrite keeps its document across a reload, and New clears it', async ({ page }) => {
    await classicDesktop(page);
    await launch(page, 'BitWrite');

    await page.getByTestId('write-editor').click();
    await page.keyboard.type('Persisted sentence');
    await page.waitForTimeout(600);

    await classicDesktop(page);
    await launch(page, 'BitWrite');
    await expect(page.getByTestId('write-editor')).toContainText('Persisted sentence');

    // New is behind a confirm, so a stray click cannot bin the document.
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await page.getByTestId('write-new-confirm').click();
    await expect(page.getByTestId('write-editor')).not.toContainText('Persisted sentence');
  });
});
