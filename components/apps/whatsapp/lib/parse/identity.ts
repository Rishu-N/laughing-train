// "Who is me?" — WhatsApp's own export filename tells you who the *other*
// person is: `WhatsApp Chat - Kumar Rishabh - IDFC.zip` on iOS, or
// `WhatsApp Chat with Kumar Rishabh - IDFC.zip` on Android. Whoever isn't
// that name is you, so you land on the right in green without being asked.

const ZIP_NAME_PATTERNS = [
  /^WhatsApp Chat with (.+)$/i, // Android
  /^WhatsApp Chat - (.+)$/i, // iOS
];

export function deriveContactName(zipFilename: string): string | null {
  const base = zipFilename.replace(/\.zip$/i, "").trim();
  for (const re of ZIP_NAME_PATTERNS) {
    const m = re.exec(base);
    if (m) return m[1].trim();
  }
  return null;
}

/** Best-guess index into `senders` for "me". Settings exposes an explicit
 * override for when this guess is wrong (mainly group chats). */
export function guessMeId(senders: string[], contactName: string | null): number {
  if (senders.length === 0) return -1;
  if (contactName) {
    const idx = senders.findIndex((s) => s.toLowerCase() === contactName.toLowerCase());
    if (idx >= 0) {
      // The first sender that isn't the identified contact — correct for
      // the common 1:1 case, a reasonable default for groups.
      const other = senders.findIndex((_, i) => i !== idx);
      if (other >= 0) return other;
    }
  }
  return 0;
}
