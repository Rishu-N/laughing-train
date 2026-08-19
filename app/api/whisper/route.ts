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
 * Only the two 400s are real errors, and both mean the request was malformed or
 * oversized before any transcription was attempted. Neither is a crash.
 *
 * OWNER: WhisperFlow agent.
 */

export const runtime = 'nodejs';

/* --------------------------------------------------------------- limits --- */

/**
 * Hard ceiling on an upload. Audio is orders of magnitude bigger than the
 * terminal's 2 KB of text, so this needs a real number: 8 MB is roughly 20
 * minutes of Opus at the bitrate MediaRecorder picks, well under OpenAI's own
 * 25 MB limit, and small enough that a hostile client cannot park a gigabyte in
 * this process's memory while formData() buffers it.
 */
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
/** Below this there is no speech in there — a mis-click, not a dictation. */
const MIN_AUDIO_BYTES = 1_200;
/** Longest single take the client should offer. Reported by GET so both agree. */
const MAX_SECONDS = 60;
/** Token bucket: this many transcriptions per IP per minute, burstable. */
const RATE_LIMIT = 12;
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
 * In-memory, per-instance token bucket — the same one the terminal route uses,
 * for the same reason: this is a portfolio site, not a bank. It resets on
 * redeploy and does not coordinate across instances.
 */
const buckets = new Map<string, Bucket>();

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() || 'local';
}

function allow(ip: string): boolean {
  const now = Date.now();

  // Cheap eviction so a long-lived instance cannot grow the map forever.
  if (buckets.size > 5000) {
    for (const [key, bucket] of buckets) {
      if (now - bucket.last > RATE_WINDOW_MS * 5) buckets.delete(key);
    }
  }

  const bucket = buckets.get(ip);
  if (!bucket) {
    buckets.set(ip, { tokens: RATE_LIMIT - 1, last: now });
    return true;
  }

  const refill = ((now - bucket.last) / RATE_WINDOW_MS) * RATE_LIMIT;
  bucket.tokens = Math.min(RATE_LIMIT, bucket.tokens + refill);
  bucket.last = now;

  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
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
  if (!allow(clientIp(req))) {
    // Deliberately NOT a 429, unlike the terminal route. There is nothing for
    // the client to do differently on a retry that it cannot do right now in
    // demo mode, and a rate limit should degrade the feature rather than break
    // the window.
    return fallback(
      'rate-limited',
      'Too many transcriptions in the last minute. Demo mode still works — try live dictation again shortly.',
    );
  }

  // Reject oversized uploads before formData() buffers them into this process.
  // The header is a claim, not a guarantee, which is why the parsed blob is
  // measured again below.
  const declared = Number(req.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > MAX_AUDIO_BYTES) {
    return badRequest(
      'audio_too_large',
      `That recording is larger than the ${Math.round(MAX_AUDIO_BYTES / (1024 * 1024))} MB limit. Try a shorter take.`,
    );
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

  if (entry.size > MAX_AUDIO_BYTES) {
    return badRequest(
      'audio_too_large',
      `That recording is larger than the ${Math.round(MAX_AUDIO_BYTES / (1024 * 1024))} MB limit. Try a shorter take.`,
    );
  }
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
