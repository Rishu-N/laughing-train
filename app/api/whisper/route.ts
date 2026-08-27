/**
 * WhisperFlow's transcription relay — the second, and last, piece of
 * server-side code in this project.
 *
 * Modelled deliberately on app/api/terminal/route.ts, because the two have the
 * same shape of problem: a key that must never leave the server, and a feature
 * that has to stay pleasant when the key is missing.
 *
 *  1. OPENAI_API_KEY is read here and NOWHERE else. It is never sent to the
 *     client, never echoed in a response, never logged, and there is no
 *     NEXT_PUBLIC_ variant of it anywhere in the repo. GET reports only a
 *     boolean — whether a key exists — which is what the app needs to decide
 *     between live dictation and its scripted demo.
 *  2. There is no failure path that 500s. No key, bad key, rate-limited,
 *     upstream on fire, no internet — every one answers 200 with
 *     `fallback: 'demo'` and a sentence the app can show, so WhisperFlow drops
 *     into demo mode instead of throwing an error at someone who only wanted to
 *     look around. A dead transcriber is not a hard failure.
 *  3. The BROWSER never talks to api.openai.com. It POSTs same-origin here and
 *     the SERVER makes the outbound call. That is what keeps
 *     tests/offline.spec.ts — "the page makes no cross-origin requests at all" —
 *     true even with a key configured, exactly as /api/terminal does.
 *
 * Only the 400s are real errors, and all of them mean the request was malformed
 * or oversized before any transcription was attempted. None is a crash.
 *
 * ── The risk this route carries ─────────────────────────────────────────────
 *
 * There is NO authentication here, and that is a stated risk rather than an
 * oversight. Anyone who can reach a deployed instance can spend the owner's
 * OpenAI credits. Everything below is a COST BOUND, not access control:
 *
 *   - a take is capped at MAX_SECONDS, enforced as the bytes such a take can
 *     occupy, so no single request can bill twenty minutes of audio;
 *   - a per-IP token bucket, plus a global one, so a client rotating through
 *     addresses still meets a ceiling rather than only slowing itself down.
 *
 * Both buckets live in this process: they reset on redeploy and do not
 * coordinate across instances, and the IP behind them comes from
 * x-forwarded-for, which is worth exactly as much as the proxy that sets it —
 * i.e. nothing at all if the route is reachable directly. The only mitigation
 * that genuinely holds is a hard spend limit on the OpenAI account itself. See
 * the OPENAI_API_KEY block in .env.example; do not deploy a key without one.
 *
 * OWNER: WhisperFlow agent.
 */

export const runtime = 'nodejs';

/* --------------------------------------------------------------- limits --- */

/**
 * Longest single take. The client reads this from GET and stops its recorder
 * there; the server holds itself to the same number via MAX_AUDIO_BYTES below,
 * so the limit GET advertises is one the server actually enforces.
 */
const MAX_SECONDS = 60;

/**
 * The most a second of audio may plausibly occupy. Chromium's MediaRecorder
 * emits mono Opus at roughly 32–48 kbps (4–6 KB/s) and Safari's AAC lands in the
 * same range, so 48 KB/s leaves about eight times the headroom a real recording
 * needs.
 */
const MAX_BYTES_PER_SECOND = 48 * 1024;

/**
 * Hard ceiling on an upload — DERIVED from the duration limit rather than picked
 * independently, because duration is not something this route can measure.
 * Knowing a take's real length means decoding the container, and there is no
 * decoder here and no dependency budget for one. Bytes are the only
 * duration-shaped bound a route in this shape can enforce honestly, so the two
 * numbers are kept in step by construction and GET reports both.
 *
 * That matters for money, not just memory. The previous flat 8 MB was roughly
 * twenty minutes of Opus, and Whisper bills by the minute of audio, so one
 * request could cost twenty times what the app's own 60-second take can. ~2.8 MB
 * now, still far under OpenAI's 25 MB limit, and still small enough that a
 * hostile client cannot park a gigabyte in this process while formData() buffers
 * it.
 */
const MAX_AUDIO_BYTES = MAX_SECONDS * MAX_BYTES_PER_SECOND;
/** Slack for the multipart wrapper when judging a request by its declared length. */
const MULTIPART_OVERHEAD_BYTES = 8 * 1024;
/** Below this there is no speech in there — a mis-click, not a dictation. */
const MIN_AUDIO_BYTES = 1_200;
/**
 * Token bucket: this many transcriptions per IP per minute, burstable. Eight is
 * far more than a person dictating into a demo will ever want and a poor rate at
 * which to mine someone else's credits.
 */
const RATE_LIMIT = 8;
/**
 * And this many per minute across ALL callers. The per-IP bucket alone is only a
 * speed bump for anything with more than one address; this is the number that
 * bounds the bill, and it is deliberately loose enough that a real audience
 * never notices it.
 */
const GLOBAL_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;
/** Give up on the model rather than hold the microphone hostage. */
const UPSTREAM_TIMEOUT_MS = 30_000;
/** Hard cap on the transcript we hand back. */
const MAX_TEXT_CHARS = 4_000;

const DEFAULT_MODEL = 'whisper-1';
const UPSTREAM_URL = 'https://api.openai.com/v1/audio/transcriptions';

/** Reason codes, so the client can react without parsing prose. */
type FallbackReason = 'no-key' | 'rate-limited' | 'upstream' | 'timeout' | 'empty';

/* ----------------------------------------------------------- rate limiter -- */

interface Bucket {
  tokens: number;
  last: number;
}

/**
 * In-memory, per-instance token buckets — the same mechanism the terminal route
 * uses, for the same reason: this is a portfolio site, not a bank. They reset on
 * redeploy and do not coordinate across instances, which is why the header
 * comment names the OpenAI spend limit as the real guard rather than these.
 *
 * Two buckets share the map: one per client IP, and one for everybody at once.
 */
const buckets = new Map<string, Bucket>();

/** The everyone-at-once bucket. No IP can collide with it — an IP has no spaces. */
const GLOBAL_KEY = 'all callers';

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() || 'local';
}

/** Refill a bucket to now, creating it full if this is its first request. */
function refill(key: string, limit: number, now: number): Bucket {
  const existing = buckets.get(key);
  if (!existing) {
    const fresh: Bucket = { tokens: limit, last: now };
    buckets.set(key, fresh);
    return fresh;
  }
  existing.tokens = Math.min(limit, existing.tokens + ((now - existing.last) / RATE_WINDOW_MS) * limit);
  existing.last = now;
  return existing;
}

/** Null when the request may proceed; otherwise which ceiling refused it. */
type Denial = 'ip' | 'global' | null;

function allow(ip: string): Denial {
  const now = Date.now();

  // Cheap eviction so a long-lived instance cannot grow the map forever. The
  // global bucket is never evicted — dropping it would hand a scraper a fresh
  // allowance every time the map filled up.
  if (buckets.size > 5000) {
    for (const [key, bucket] of buckets) {
      if (key !== GLOBAL_KEY && now - bucket.last > RATE_WINDOW_MS * 5) buckets.delete(key);
    }
  }

  const mine = refill(ip, RATE_LIMIT, now);
  const everyone = refill(GLOBAL_KEY, GLOBAL_LIMIT, now);

  if (mine.tokens < 1) return 'ip';
  if (everyone.tokens < 1) return 'global';

  // Charged only once both ceilings agree, so a request one bucket refuses is
  // not silently billed against the other.
  mine.tokens -= 1;
  everyone.tokens -= 1;
  return null;
}

/* ---------------------------------------------------------------- helpers -- */

function model(): string {
  return process.env.WHISPER_MODEL || DEFAULT_MODEL;
}

/**
 * The no-transcript answer.
 *
 * 200, always. The client treats a non-200 as a hard failure, and a missing key
 * is not a hard failure — it is the expected state of a fresh clone. The app
 * reads `fallback` and switches to its scripted demo, which needs no key, no
 * microphone and no network.
 */
function fallback(reason: FallbackReason, notice: string): Response {
  return Response.json({ text: '', fallback: 'demo', reason, notice }, { status: 200 });
}

/** The only genuine errors: the request never described a usable recording. */
function badRequest(error: string, notice: string): Response {
  return Response.json({ error, notice }, { status: 400 });
}

/**
 * Refusal for an over-long take. Phrased in seconds first because that is the
 * limit the app advertises and the one a person can act on; the megabytes are
 * only how the server measures it.
 */
function tooLarge(): Response {
  return badRequest(
    'audio_too_large',
    `That recording is longer than the ${MAX_SECONDS}-second limit for a single take ` +
      `(over ${(MAX_AUDIO_BYTES / (1024 * 1024)).toFixed(1)} MB). Try a shorter take.`,
  );
}

/**
 * Whisper picks its decoder from the filename extension, so an upload named
 * `blob` is rejected upstream no matter how valid the bytes are. MediaRecorder
 * hands us a MIME type; this maps it onto something the API recognises.
 */
const EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  // Chromium labels an audio-only MediaRecorder stream video/webm on some builds.
  'video/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/oga': 'oga',
  'audio/mp4': 'mp4',
  'audio/x-m4a': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/flac': 'flac',
};

function extensionFor(type: string): string {
  // `audio/webm;codecs=opus` — the parameters are not part of the lookup.
  const base = type.split(';')[0]?.trim().toLowerCase() ?? '';
  return EXTENSIONS[base] ?? 'webm';
}

/** Collapse the model's output to a single tidy utterance. */
function tidy(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_CHARS);
}

/* -------------------------------------------------------------------- GET -- */

/**
 * Capability probe. Answers whether live dictation is possible at all, so the
 * app can say so plainly in its installer instead of letting someone press
 * Record and discover the hard way.
 *
 * `live` is a boolean derived from the key. The key itself, its length and its
 * prefix all stay here.
 *
 * Both limits are reported because both are enforced: `maxSeconds` is what the
 * client's recorder stops itself at, and `maxBytes` is how this route enforces
 * the same bound on an upload it did not produce (see MAX_AUDIO_BYTES).
 */
export async function GET(): Promise<Response> {
  return Response.json(
    {
      live: Boolean(process.env.OPENAI_API_KEY),
      model: model(),
      maxBytes: MAX_AUDIO_BYTES,
      maxSeconds: MAX_SECONDS,
    },
    { status: 200, headers: { 'cache-control': 'no-store' } },
  );
}

/* ------------------------------------------------------------------- POST -- */

export async function POST(req: Request): Promise<Response> {
  const denied = allow(clientIp(req));
  if (denied) {
    // Deliberately NOT a 429, unlike the terminal route. There is nothing for
    // the client to do differently on a retry that it cannot do right now in
    // demo mode, and a rate limit should degrade the feature rather than break
    // the window. The two ceilings get different sentences because "slow down"
    // and "the site is busy" are different situations to be in.
    return fallback(
      'rate-limited',
      denied === 'ip'
        ? 'Too many transcriptions from here in the last minute. Demo mode still works — try live dictation again shortly.'
        : 'This demo is transcribing for a lot of people right now. Demo mode still works — try live dictation again shortly.',
    );
  }

  // Reject oversized uploads before formData() buffers them into this process.
  // The header is a claim, not a guarantee, which is why the parsed blob is
  // measured again below. (A chunked upload declares no length at all; the host
  // platform's own body limit is what bounds that case, which is another reason
  // MAX_AUDIO_BYTES is modest.)
  //
  // The allowance is for the multipart envelope — boundaries and part headers —
  // so a recording that is exactly at the limit is not refused for the wrapper
  // it arrived in. The exact test is on the parsed blob.
  const declared = Number(req.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > MAX_AUDIO_BYTES + MULTIPART_OVERHEAD_BYTES) {
    return tooLarge();
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest('invalid_body', 'Malformed upload. Expected multipart form data with audio.');
  }

  // `audio` is what this app sends; `file` is what an OpenAI-shaped client would
  // send, and accepting both costs one line.
  const entry = form.get('audio') ?? form.get('file');
  if (!(entry instanceof Blob)) {
    return badRequest('missing_audio', 'No audio in that request.');
  }

  if (entry.size > MAX_AUDIO_BYTES) return tooLarge();
  if (entry.size < MIN_AUDIO_BYTES) {
    return badRequest(
      'audio_too_short',
      'That recording was too short to contain speech. Hold Record for a second or two.',
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // The expected state for a fresh clone, and the only state that works with
    // no internet. A normal answer, not an error.
    return fallback(
      'no-key',
      'No transcription key is configured on this server, so live dictation is off. Demo mode replays scripted transcripts instead.',
    );
  }

  try {
    const upstream = new FormData();
    // The third argument is the filename Whisper reads the container format
    // from; without it the API rejects the part regardless of the bytes.
    upstream.append('file', entry, `dictation.${extensionFor(entry.type)}`);
    upstream.append('model', model());
    upstream.append('response_format', 'json');

    const res = await fetch(UPSTREAM_URL, {
      method: 'POST',
      // Only the Authorization header. fetch derives the multipart boundary from
      // the FormData body, so setting content-type here would corrupt it.
      headers: { authorization: `Bearer ${apiKey}` },
      body: upstream,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (!res.ok) {
      // Bad key, quota, model not enabled on the account. The upstream body can
      // quote the request back, so none of it is forwarded — only the status,
      // which carries no secrets.
      return fallback(
        'upstream',
        `The transcription service answered ${res.status}. Falling back to demo mode.`,
      );
    }

    const data: unknown = await res.json().catch(() => null);
    const raw =
      data && typeof data === 'object' && 'text' in data && typeof data.text === 'string'
        ? data.text
        : '';
    const text = tidy(raw);

    if (!text) {
      // A real, successful transcription of silence. Worth saying plainly: the
      // usual cause is the wrong input device, not a broken app.
      return fallback(
        'empty',
        'The transcript came back empty. That usually means silence — check which microphone is selected.',
      );
    }

    return Response.json({ text, model: model(), source: 'live' }, { status: 200 });
  } catch (err) {
    // Timeout, DNS failure, or — most likely — no internet at all. Same answer
    // either way, and still a 200: the app has somewhere useful to go.
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    return fallback(
      timedOut ? 'timeout' : 'upstream',
      timedOut
        ? 'The transcription service took too long. Falling back to demo mode.'
        : 'Could not reach the transcription service. Falling back to demo mode.',
    );
  }
}
