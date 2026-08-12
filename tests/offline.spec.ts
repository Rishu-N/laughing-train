/**
 * Offline mode.
 *
 * The promise is that you can clone this, get on a plane, and it works. These
 * tests guard the two things that would quietly break that: the terminal
 * falling back to useless quips instead of answering locally, and a font that
 * secretly needs Google.
 */
import { expect, test } from '@playwright/test';

/** Ask the terminal API something and return the parsed reply. */
async function ask(request: import('@playwright/test').APIRequestContext, input: string) {
  const res = await request.post('/api/terminal', { data: { input } });
  expect(res.status()).toBe(200);
  return (await res.json()) as { reply: string; offline?: boolean };
}

test('the terminal answers real questions locally, with no model', async ({ request }) => {
  // Whoever it is, it must answer with the name from content/bio.ts rather than
  // a "no carrier" shrug.
  const who = await ask(request, 'who are you');
  expect(who.offline).toBe(true);
  expect(who.reply.length).toBeGreaterThan(10);
  expect(who.reply).not.toMatch(/NO CARRIER|BUSY SIGNAL|PACKET LOST/i);

  const projects = await ask(request, 'what projects have you built');
  expect(projects.reply).toMatch(/disk|open /i);

  const contact = await ask(request, 'how do I contact you');
  expect(contact.reply).toMatch(/@|GitHub|reach/i);

  const games = await ask(request, 'any games to play');
  expect(games.reply).toMatch(/Fact-sweeper|Snake|2048/i);
});

test('an unrecognised question still answers in character, never an error', async ({
  request,
}) => {
  const res = await ask(request, 'qwertyuiop zxcvbnm nonsense');
  expect(res.offline).toBe(true);
  expect(res.reply.trim().length).toBeGreaterThan(0);
});

test('the pixel fonts are self-hosted, not fetched from Google', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    const url = r.url();
    if (/fonts\.(googleapis|gstatic)\.com/.test(url)) external.push(url);
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  expect(
    external,
    'the page must not request Google Fonts — they are vendored in app/fonts',
  ).toEqual([]);
});

test('the page makes no cross-origin requests at all', async ({ page, baseURL }) => {
  const offsite: string[] = [];
  page.on('request', (r) => {
    const url = r.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return;
    if (baseURL && url.startsWith(baseURL)) return;
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) return;
    offsite.push(url);
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  expect(offsite, `unexpected off-site requests: ${offsite.join(', ')}`).toEqual([]);
});
