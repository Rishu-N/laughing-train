// Resolves the media a message *references* (`mediaKey` from the parser)
// against the media *files actually present* in the zip. A WhatsApp
// export's text always names an attachment even when the media itself
// wasn't included (chat exported "without media"), so this step is what
// tells the difference between "render the real photo" and "render a
// placeholder tile" — and it mutates the model's flags to match.
import { Flag, type ChatModel } from "../model";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  gif: "image/gif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  "3gp": "video/3gpp",
  avi: "video/x-msvideo",
  opus: "audio/ogg", // WhatsApp voice notes are Opus-in-Ogg despite the extension
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  aac: "audio/aac",
  wav: "audio/wav",
  vcf: "text/vcard",
  pdf: "application/pdf",
};

export function mimeFromFilename(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const ext = dot >= 0 ? filename.slice(dot + 1).toLowerCase() : "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

function basename(path: string): string {
  const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return slash >= 0 ? path.slice(slash + 1) : path;
}

/**
 * Matches each message's referenced filename against the zip's actual
 * entries and returns a Blob per resolved file, keyed by the *model's*
 * mediaKey (not the zip's raw entry name) so callers never need to
 * re-derive the mapping.
 *
 * Any message whose reference can't be resolved (export was made
 * "without media", or the file is simply missing) has its HAS_FILE flag
 * cleared and OMITTED set in place, so the UI can treat it exactly like
 * a same-type placeholder without a second pass over the model.
 */
export function resolveMedia(
  model: ChatModel,
  zipFiles: Map<string, Uint8Array>,
): Map<string, Blob> {
  const byBasenameLower = new Map<string, string>();
  for (const key of zipFiles.keys()) {
    byBasenameLower.set(basename(key).toLowerCase(), key);
  }

  const blobs = new Map<string, Blob>();

  for (let i = 0; i < model.count; i++) {
    if (!(model.flags[i] & Flag.HAS_FILE)) continue;
    const ref = model.mediaKey[i];
    if (!ref) continue;

    let zipKey = zipFiles.has(ref) ? ref : undefined;
    if (!zipKey) zipKey = byBasenameLower.get(basename(ref).toLowerCase());

    if (!zipKey) {
      // Referenced but not present in this zip — fall back to a
      // placeholder tile rather than a broken media link.
      model.flags[i] = (model.flags[i] & ~Flag.HAS_FILE) | Flag.OMITTED;
      model.mediaKey[i] = null;
      continue;
    }

    if (!blobs.has(ref)) {
      const bytes = zipFiles.get(zipKey)!;
      // Slice to a plain ArrayBuffer-backed view so the Blob doesn't pin
      // the whole zip's decoded buffer in memory.
      const copy = bytes.slice();
      blobs.set(ref, new Blob([copy], { type: mimeFromFilename(zipKey) }));
    }
  }

  return blobs;
}
