/**
 * WhisperFlow: the installer gate, demo mode, the live path, the hand-off into
 * Notes, and the contract of /api/whisper.
 *
 * Nothing here needs a microphone or an API key, and nothing here should ever
 * be made to need one — CI has neither. Two deliberate choices follow from that:
 *
 *  - **The suite works either way on the key.** Adding OPENAI_API_KEY to
 *    .env.local must not turn these red, so anything whose answer depends on the
 *    key asks GET /api/whisper first rather than assuming the fresh-clone state.
 *    A test that only passes on a machine with no key is a test that gets
 *    deleted the first time someone configures one.
 *  - **The live path is exercised with a stubbed microphone and a mocked
 *    /api/whisper.** MediaRecorder and getUserMedia are replaced before the page
 *    loads, so the whole client half — press, record, upload, transcript, Notes,
 *    release the device — runs end to end with no hardware and no credits spent.
 *    Only the server's outbound call to OpenAI stays untested, which is the one
 *    piece that genuinely cannot be reached without a key.
 *
 * The route itself is hit directly the way tests/terminal.spec.ts does it. Each
 * of those tests sends its own `x-forwarded-for` so it gets its own rate-limit
 * bucket and cannot throttle its neighbours.
 */
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { bootToDesktop, closeWindow, openAppFromMenu, windowByTitle } from './helpers';

const APP = 'WhisperFlow';

/** What the mocked server "hears". Distinctive enough to be unambiguous in Notes. */
const LIVE_LINE = 'This sentence came back from the transcription service.';

/** A bucket of this test's own, so a flood in one test cannot fail another. */
function fromIp(ip: string): Record<string, string> {
  return { 'x-forwarded-for': ip };
}

/** Does this server have a key configured? Everything key-dependent asks first. */
async function serverIsLive(request: APIRequestContext): Promise<boolean> {
  const res = await request.get('/api/whisper');
  const body = (await res.json()) as { live?: boolean };
  return body.live === true;
}

/** Open WhisperFlow and click through the installer, leaving the panel on screen. */
async function install(page: Page) {
  await openAppFromMenu(page, APP);
  const win = windowByTitle(page, new RegExp(`^${APP}`));
  await expect(win).toBeVisible();
  await win.getByRole('button', { name: 'Install' }).click();
  return win;
}

/**
 * Put the app in demo mode whatever the server said.
 *
 * With no key it is already there — that is the default and worth asserting
 * separately. With a key the app opens in live mode, so demo has to be chosen,
 * which is exactly the control a visitor would use.
 */
async function useDemoMode(win: Locator) {
  if (await win.getByText('DEMO', { exact: true }).first().isVisible()) return;
  await win.getByRole('button', { name: 'Settings' }).click();
  await win.getByRole('radio', { name: /^Demo mode/ }).check();
  await win.getByRole('button', { name: 'Transcript' }).click();
  await expect(win.getByText('DEMO', { exact: true }).first()).toBeVisible();
}

/**
 * Replace getUserMedia and MediaRecorder before any page script runs.
 *
 * The fake stream is a real MediaStream (from a WebAudio destination), so the
 * tracks are real tracks and `track.stop()` genuinely ends them — which is what
 * makes "the microphone was released" an assertion rather than a hope. Calls and
 * streams are recorded on `__mic` so a test can prove the device was opened
 * once, by a press, and closed after.
 *
 * `delayMs` models a permission prompt that sits there unanswered.
 */
async function stubMicrophone(page: Page, delayMs = 0) {
  await page.addInitScript((delay: number) => {
    const probe = { calls: 0, streams: [] as MediaStream[] };
    (window as unknown as { __mic: typeof probe }).__mic = probe;

    const getUserMedia = async (): Promise<MediaStream> => {
      probe.calls += 1;
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      const stream = new AudioContext().createMediaStreamDestination().stream;
      probe.streams.push(stream);
      return stream;
    };

    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true });
    }
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: getUserMedia,
      configurable: true,
      writable: true,
    });

    class FakeMediaRecorder {
      static isTypeSupported() {
        return true;
      }
      state = 'inactive';
      mimeType: string;
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(_stream: MediaStream, options?: { mimeType?: string }) {
        this.mimeType = options?.mimeType ?? 'audio/webm';
      }
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        // 4 KB: over the hook's floor and the route's, and small enough to post.
        const data = new Blob([new Uint8Array(4096)], { type: this.mimeType });
        this.ondataavailable?.({ data });
        this.onstop?.();
      }
    }

    Object.defineProperty(window, 'MediaRecorder', {
      value: FakeMediaRecorder,
      configurable: true,
      writable: true,
    });
  }, delayMs);
}

/** How many times the page has asked for the microphone. */
function micCalls(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __mic: { calls: number } }).__mic.calls);
}

/** readyState of every track the page was ever handed. 'ended' means released. */
function micTrackStates(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    (window as unknown as { __mic: { streams: MediaStream[] } }).__mic.streams.flatMap((stream) =>
      stream.getTracks().map((track) => track.readyState as string),
    ),
  );
}

/**
 * Answer /api/whisper in the browser, so the live client path can be driven
 * without a key. Same-origin either way — the page still never calls OpenAI.
 */
async function mockWhisper(page: Page, uploads: string[]) {
  await page.route('**/api/whisper', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        json: { live: true, model: 'whisper-1', maxBytes: 2_949_120, maxSeconds: 60 },
      });
      return;
    }
    uploads.push(route.request().postData() ?? '');
    await route.fulfill({ json: { text: LIVE_LINE, model: 'whisper-1', source: 'live' } });
  });
}

/* ------------------------------------------------------------------- the app -- */

test('the installer fronts the first launch and is honest about live dictation', async ({
  page,
  request,
}) => {
  const live = await serverIsLive(request);

  await bootToDesktop(page);
  await openAppFromMenu(page, APP);

  const win = windowByTitle(page, new RegExp(`^${APP}`));
  await expect(win).toBeVisible();
  await expect(win.getByRole('button', { name: 'Install' })).toBeVisible();
  await expect(win.getByText('Live transcription')).toBeVisible();

  // The capability probe is async, so this is the one assertion worth a generous
  // timeout. With no key the installer must say so rather than let someone press
  // Record and find out the hard way; with a key it must not cry wolf.
  const caveat = win.getByText('not available right now');
  if (live) {
    await expect(caveat).toHaveCount(0);
  } else {
    await expect(caveat.first()).toBeVisible({ timeout: 15_000 });
  }
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

test('demo mode produces a transcript, labels it, and lands it in Notes tagged [demo]', async ({
  page,
  request,
}) => {
  const live = await serverIsLive(request);

  // The browser must never reach OpenAI itself — the server does that. This is
  // the same guarantee tests/offline.spec.ts makes for the page as a whole.
  const offsite: string[] = [];
  page.on('request', (r) => {
    if (/openai\.com/.test(r.url())) offsite.push(r.url());
  });

  await bootToDesktop(page);
  const win = await install(page);

  // With no key, demo mode is not merely available — it is where the app opens.
  if (!live) await expect(win.getByText('DEMO', { exact: true }).first()).toBeVisible();
  await useDemoMode(win);

  await win.getByRole('button', { name: 'Play a demo dictation' }).click();

  // The scripted line types itself out into the transcript box...
  const transcript = win.getByRole('textbox', { name: 'Transcript' });
  await expect(transcript).toHaveValue(/[a-z]{8}/i, { timeout: 20_000 });

  // ...and lands in Notes, which opens itself, tagged so the scripted line can
  // never be mistaken for something that was actually heard. The tag is applied
  // by Notes, from the `source` on the dictation event, and it is the only place
  // the distinction survives into a plain-text document — so it is asserted
  // here, in the app that produces the event, rather than left to Notes' own
  // tests.
  const note = page.getByRole('textbox', { name: 'Note text' });
  await expect(note).toBeVisible({ timeout: 20_000 });
  await expect(note).toHaveValue(/^\[demo\] \S/);

  // Nothing was recorded to produce that: demo mode never touches the device.
  expect(offsite, `the page called OpenAI directly: ${offsite.join(', ')}`).toEqual([]);
});

test('a live take opens the microphone once, lands an untagged transcript, and releases it', async ({
  page,
}) => {
  const uploads: string[] = [];
  await stubMicrophone(page);
  await mockWhisper(page, uploads);

  await bootToDesktop(page);
  const win = await install(page);

  // The server reports a key, so the app opens ready to listen...
  await expect(win.getByText('LIVE', { exact: true }).first()).toBeVisible();
  // ...and has still not touched the microphone. Nothing opens it but a press:
  // not mounting the app, not choosing live mode, not the capability probe.
  expect(await micCalls(page)).toBe(0);

  await win.getByRole('button', { name: 'Start recording' }).click();

  // Recording has to be unmistakable, and is: a red strip, the word itself, a
  // pulsing dot and a running clock.
  const strip = win.locator('[data-recording]');
  await expect(strip).toHaveAttribute('data-recording', 'true');
  await expect(strip).toContainText('RECORDING');
  expect(await micCalls(page)).toBe(1);

  // A take shorter than MIN_TAKE_MS is treated as a slip of the finger.
  await page.waitForTimeout(900);
  await win.getByRole('button', { name: 'Stop recording' }).click();

  const transcript = win.getByRole('textbox', { name: 'Transcript' });
  await expect(transcript).toHaveValue(LIVE_LINE);

  // A real transcript is NOT tagged. Only the scripted one is — that asymmetry
  // is the whole point of the tag.
  const note = page.getByRole('textbox', { name: 'Note text' });
  await expect(note).toBeVisible({ timeout: 20_000 });
  await expect(note).toHaveValue(LIVE_LINE);

  // The upload is shaped the way the route expects: one multipart part named
  // `audio`, with an extension, because Whisper picks its decoder from the
  // filename and rejects a part called `blob` however valid the bytes are.
  expect(uploads).toHaveLength(1);
  expect(uploads[0]).toContain('name="audio"');
  expect(uploads[0]).toContain('filename="dictation.webm"');

  // And the device was let go the moment the take ended. A live track is what
  // keeps the browser's recording indicator lit.
  expect(await micTrackStates(page)).toEqual(['ended']);
  await expect(strip).toHaveAttribute('data-recording', 'false');
});

test('a tab going to the background ends the take and releases the microphone', async ({
  page,
}) => {
  const uploads: string[] = [];
  await stubMicrophone(page);
  await mockWhisper(page, uploads);

  await bootToDesktop(page);
  const win = await install(page);
  await win.getByRole('button', { name: 'Start recording' }).click();

  const strip = win.locator('[data-recording]');
  await expect(strip).toHaveAttribute('data-recording', 'true');
  await page.waitForTimeout(900);

  // A page under test is never actually backgrounded, so the two things the app
  // reads — the state and the event — are produced directly.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  // A microphone held open behind a hidden tab is exactly the thing that
  // deserves suspicion, so the take ends rather than continuing.
  await expect(strip).toHaveAttribute('data-recording', 'false');
  expect(await micTrackStates(page)).toEqual(['ended']);
  // Nothing is thrown away: what was already said still gets transcribed.
  expect(uploads).toHaveLength(1);
});

test('cancelling while the permission prompt is up never opens a recording', async ({ page }) => {
  const uploads: string[] = [];
  // A prompt that sits unanswered for a second and a half.
  await stubMicrophone(page, 1_500);
  await mockWhisper(page, uploads);

  await bootToDesktop(page);
  const win = await install(page);
  await win.getByRole('button', { name: 'Start recording' }).click();

  const strip = win.locator('[data-recording]');
  await win.getByRole('button', { name: 'Cancel' }).click();
  await expect(strip).toHaveAttribute('data-recording', 'false');

  // The permission answer arrives after the take is gone. It must not resurrect
  // it: allowing the microphone is not the same as asking to record, and a
  // stream that arrives late is stopped on sight.
  await page.waitForTimeout(2_000);
  await expect(strip).toHaveAttribute('data-recording', 'false');
  expect(await micTrackStates(page)).toEqual(['ended']);
  expect(uploads).toEqual([]);
});

/* ----------------------------------------------------------------- the route -- */

test('GET /api/whisper reports capability without leaking anything', async ({ request }) => {
  const res = await request.get('/api/whisper');
  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(typeof body.live).toBe('boolean');
  expect(typeof body.model).toBe('string');
  // Both limits are advertised, and both are enforced: maxBytes is how the
  // server holds an upload to maxSeconds without decoding it.
  expect(body.maxSeconds).toBeGreaterThan(0);
  expect(body.maxBytes).toBeGreaterThan(0);
  expect(body.maxBytes).toBeLessThanOrEqual(body.maxSeconds * 64 * 1024);
  expect(JSON.stringify(body)).not.toMatch(/sk-|OPENAI_API_KEY/i);
});

test('POST /api/whisper answers 200 with a demo fallback when no API key is set', async ({
  request,
}) => {
  test.skip(
    await serverIsLive(request),
    'a key is configured on this server, so there is no no-key path to take',
  );

  const res = await request.post('/api/whisper', {
    headers: fromIp('198.51.100.11'),
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
  expect(body.text).toBe('');
  expect(typeof body.notice).toBe('string');
  expect(body.notice.length).toBeGreaterThan(0);
  expect(JSON.stringify(body)).not.toMatch(/sk-|OPENAI_API_KEY/i);
});

test('POST /api/whisper rejects a malformed request with 400, not a crash', async ({ request }) => {
  // JSON where multipart audio was expected.
  const res = await request.post('/api/whisper', {
    headers: fromIp('198.51.100.12'),
    data: { input: 'not audio' },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toBe('invalid_body');
});

test('POST /api/whisper rejects a multipart request with no audio in it', async ({ request }) => {
  const res = await request.post('/api/whisper', {
    headers: fromIp('198.51.100.13'),
    multipart: { note: 'where is the audio' },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toBe('missing_audio');
  expect(typeof body.notice).toBe('string');
});

test('POST /api/whisper rejects a take too short to contain speech', async ({ request }) => {
  const res = await request.post('/api/whisper', {
    headers: fromIp('198.51.100.14'),
    multipart: {
      audio: { name: 'dictation.webm', mimeType: 'audio/webm', buffer: Buffer.alloc(64) },
    },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toBe('audio_too_short');
});

test('POST /api/whisper rejects an upload longer than one take, in seconds', async ({ request }) => {
  const { maxBytes, maxSeconds } = await (await request.get('/api/whisper')).json();

  const res = await request.post('/api/whisper', {
    headers: fromIp('198.51.100.15'),
    multipart: {
      audio: {
        name: 'dictation.webm',
        mimeType: 'audio/webm',
        // Comfortably past the ceiling, so this is refused on the declared
        // length before anything is buffered into the server.
        buffer: Buffer.alloc(maxBytes + 64 * 1024, 1),
      },
    },
  });

  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toBe('audio_too_large');
  // The refusal is phrased as the limit the app actually advertises. Bytes are
  // only how a route with no decoder can measure it.
  expect(body.notice).toContain(`${maxSeconds}-second`);
});

/**
 * Last in the file on purpose: it is the only test that deliberately exhausts a
 * limit, and the route has a global ceiling as well as a per-IP one. Running it
 * at the end leaves the shared bucket full for everything above.
 */
test('POST /api/whisper degrades to demo mode under a flood instead of failing', async ({
  request,
}) => {
  const headers = fromIp('203.0.113.9');
  // Deliberately too short to transcribe: the limiter runs before the size
  // checks and before the key is even read, so a flood costs nothing upstream —
  // which is the property being tested as much as the limit itself.
  const multipart = {
    audio: { name: 'dictation.webm', mimeType: 'audio/webm', buffer: Buffer.alloc(64) },
  };

  const seen: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const res = await request.post('/api/whisper', { headers, multipart });
    expect(res.status(), 'a rate limit must never become a 5xx').toBeLessThan(500);
    const body = await res.json();
    seen.push(body.reason ?? body.error ?? 'none');
    if (body.reason === 'rate-limited') {
      // Refused, and still a 200 with somewhere to go: there is nothing a retry
      // gives the client that demo mode does not give it right now.
      expect(res.status()).toBe(200);
      expect(body.fallback).toBe('demo');
      expect(body.text).toBe('');
      expect(body.notice).toMatch(/demo mode/i);
    }
  }

  expect(seen[0]).toBe('audio_too_short');
  expect(seen).toContain('rate-limited');
});
