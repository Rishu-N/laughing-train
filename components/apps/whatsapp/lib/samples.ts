/**
 * The bridge between content/conversations.ts and the importer.
 *
 * Nothing here holds any chat text — it only works out where a sample lives
 * and what WhatsApp would have called its zip. The messages themselves are
 * written in content/, turned into real .zip exports by
 * scripts/generate-sample-chats.mjs, and read back through the same parser a
 * dropped file goes through. There is no shortcut path that skips the parse.
 */
import type { MockConversation } from '@/content/conversations';

/** Where `npm run samples` writes each export. Same-origin — see §14 offline. */
export function sampleZipUrl(conversationId: string): string {
  return `/downloads/${conversationId}.zip`;
}

/**
 * A stable IndexedDB id per sample, so opening "Priya" from the Downloads
 * folder five times gives you one chat in history rather than five. Prefixed
 * rather than raw so it can never collide with the crypto.randomUUID() a real
 * import gets.
 */
export function sampleChatId(conversationId: string): string {
  return `sample:${conversationId}`;
}

/**
 * The filename WhatsApp's own export would carry: `WhatsApp Chat - <name>.zip`.
 *
 * It is not the name on disk — the folder needs a predictable URL — but it is
 * what the parser sees, because lib/parse/identity.ts derives "who is the other
 * person" from it and that is what decides whose bubbles are green. For a 1:1
 * chat the name is simply the other participant. For a group WhatsApp uses the
 * group's subject, and the closest thing content/ has is the part of the title
 * before the dash ("Dev group — shipping WhisperFlow").
 */
export function sampleZipName(conversation: MockConversation): string {
  const others = conversation.participants.filter((p) => p !== conversation.me);
  const name =
    others.length === 1 ? others[0] : conversation.title.split(/\s+[—–-]\s+/)[0].trim();
  return `WhatsApp Chat - ${name || conversation.title}.zip`;
}

/** Rough size of a sample, for the Downloads listing, before the file loads. */
export function messageCount(conversation: MockConversation): number {
  return conversation.messages.length;
}
