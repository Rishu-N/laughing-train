/**
 * WhisperFlow: the installer gate, demo mode, the hand-off into Notes, and the
 * contract of POST /api/whisper.
 *
 * Nothing here needs a microphone or an API key, and nothing here should ever
 * be made to need one — CI has neither. The live path is exercised only as far
 * as the route, which with no OPENAI_API_KEY set must answer 200 telling the
 * client to fall back to demo mode, exactly as /api/terminal answers 200 with
 * `offline: true`.
 */
import { expect, test, type Page } from '@playwright/test';
import { bootToDesktop, closeWindow, openAppFromMenu, windowByTitle } from './helpers';

const APP = 'WhisperFlow';

/** Open WhisperFlow and click through the installer, leaving the panel on screen. */
async function install(page: Page) {
  await openAppFromMenu(page, APP);
  const win = windowByTitle(page, new RegExp(`^${APP}`));
  await expect(win).toBeVisible();
  await win.getByRole('button', { name: 'Install' }).click();
  return win;
}

test('the installer fronts the first launch and says live dictation is off', async ({ page }) => {
  await bootToDesktop(page);
  await openAppFromMenu(page, APP);

  const win = windowByTitle(page, new RegExp(`^${APP}`));
  await expect(win).toBeVisible();
  await expect(win.getByRole('button', { name: 'Install' })).toBeVisible();

  // With no key configured the installer must say so rather than let someone
  // press Record and find out the hard way. The capability probe is async, so
  // this is the one assertion worth a generous timeout.
  await expect(win.getByText('not available right now').first()).toBeVisible({ timeout: 15_000 });
});

test('the installer is shown once, and can be summoned again from Settings', async ({ page }) => {
  await bootToDesktop(page);
  const win = await install(page);

  // Installed: the panel, not the installer.
  await expect(win.getByRole('button', { name: 'Install' })).toHaveCount(0);
  await expect(win.getByRole('textbox', { name: 'Transcript' })).toBeVisible();

  // Closing and reopening does not ask again — the answer is remembered by
  // useAppSession, which flushes on unmount.
  await closeWindow(page, win);
  await openAppFromMenu(page, APP);
  const reopened = windowByTitle(page, new RegExp(`^${APP}`));
  await expect(reopened.getByRole('textbox', { name: 'Transcript' })).toBeVisible();
  await expect(reopened.getByRole('button', { name: 'Install' })).toHaveCount(0);

  // ...but it is always re-openable, which is why there is no "don't show again".
  await reopened.getByRole('button', { name: 'Settings' }).click();
  await reopened.getByRole('button', { name: 'Show installer again' }).click();
  await expect(reopened.getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('demo mode produces a transcript, labels it, and lands it in Notes', async ({ page }) => {
  // The browser must never reach OpenAI itself — the server does that. This is
  // the same guarantee tests/offline.spec.ts makes for the page as a whole.
  const offsite: string[] = [];
  page.on('request', (r) => {
    if (/openai\.com/.test(r.url())) offsite.push(r.url());
  });

  await bootToDesktop(page);
  const win = await install(page);

  // No key, so the app opens in demo mode and says so.
  await expect(win.getByText('DEMO').first()).toBeVisible();

  await win.getByRole('button', { name: 'Play a demo dictation' }).click();

  // The scripted line types itself out into the transcript box...
  const transcript = win.getByRole('textbox', { name: 'Transcript' });
  await expect(transcript).toHaveValue(/[a-z]{8}/i, { timeout: 20_000 });

  // ...and lands in Notes, which opens itself, tagged so the scripted line can
  // never be mistaken for something that was actually heard.
  const note = page.getByRole('textbox', { name: 'Note text' });
  await expect(note).toBeVisible({ timeout: 20_000 });
  await expect(note).toHaveValue(/^\[demo\] \S/);

  expect(offsite, `the page called OpenAI directly: ${offsite.join(', ')}`).toEqual([]);
});

test('GET /api/whisper reports capability without leaking anything', async ({ request }) => {
  const res = await request.get('/api/whisper');
  expect(res.status()).toBe(200);

  const body = await res.json();
  // No key in CI, so live dictation is off and demo mode is the whole app.
  expect(body.live).toBe(false);
  expect(typeof body.model).toBe('string');
  expect(JSON.stringify(body)).not.toMatch(/sk-|OPENAI_API_KEY/i);
});

test('POST /api/whisper answers 200 with a demo fallback when no API key is set', async ({
  request,
}) => {
  const res = await request.post('/api/whisper', {
    multipart: {
      audio: {
        name: 'dictation.webm',
        mimeType: 'audio/webm',
        buffer: Buffer.alloc(4096, 1),
      },
    },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.fallback).toBe('demo');
  expect(body.reason).toBe('no-key');
  expect(typeof body.notice).toBe('string');
  expect(body.notice.length).toBeGreaterThan(0);
  expect(JSON.stringify(body)).not.toMatch(/sk-|OPENAI_API_KEY/i);
});

test('POST /api/whisper rejects a malformed request with 400, not a crash', async ({ request }) => {
  // JSON where multipart audio was expected.
  const res = await request.post('/api/whisper', { data: { input: 'not audio' } });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toBe('invalid_body');
});

test('POST /api/whisper rejects a take too short to contain speech', async ({ request }) => {
  const res = await request.post('/api/whisper', {
    multipart: {
      audio: { name: 'dictation.webm', mimeType: 'audio/webm', buffer: Buffer.alloc(64) },
    },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toBe('audio_too_short');
});
