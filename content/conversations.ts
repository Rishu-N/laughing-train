/**
 * content/conversations.ts — the sample chats that ship in the Downloads folder.
 *
 * ⚠️ DRAFT CONTENT, WRITTEN FOR REVIEW. These put words in the owner's mouth.
 * They were invented to fill the WhatsApp Simulator with something real to open,
 * and every line is meant to be rewritten or deleted. Nothing here is a quote.
 *
 * `npm run samples` turns each entry below into a real WhatsApp `.zip` export in
 * public/downloads/. The zip is the point: the importer accepts .zip only
 * (components/apps/whatsapp — Sidebar), so loose text would not load.
 *
 * WHY THESE THREE
 *   The four entries in content/projects.ts are still placeholders, so chats
 *   "about the projects" would have been chats about nothing. These are about
 *   the three things in this repo that genuinely exist: the OS you are reading
 *   this in, the Mac dictation app, and the chat tool rendering the messages.
 *
 * EDITING
 *   • Change any text freely, then re-run `npm run samples`.
 *   • `me` must match one of `participants` — it is who the green bubbles
 *     belong to.
 *   • Times are 24-hour "HH:MM". `day` is an offset in days from `startDate`,
 *     so a conversation can span dates without you writing out every one.
 *   • A few lines deliberately exercise the parser's edge cases — omitted
 *     media, an edited message, a deleted one. Keep at least one of each if you
 *     want the sample to show off what the importer handles.
 */

export interface MockMessage {
  /** Must be one of the conversation's `participants`, or 'system' for a notice. */
  from: string;
  /** 24-hour clock, "HH:MM". */
  at: string;
  /** Days after `startDate`. Omit for day 0. */
  day?: number;
  /** The message body. Multi-line is fine — use \n. */
  text: string;
  /**
   * Renders as WhatsApp's "<media> omitted" placeholder rather than as text.
   * The simulator draws a labelled tile for these, which is worth demonstrating.
   */
  omitted?: 'image' | 'video' | 'sticker' | 'audio' | 'document' | 'GIF';
  /** Appends WhatsApp's "<This message was edited>" marker. */
  edited?: boolean;
  /** Renders as WhatsApp's tombstone for a deleted message. */
  deleted?: boolean;
}

export interface MockConversation {
  /** Used as the .zip filename and the id the Downloads folder passes to the app. */
  id: string;
  /** Shown in the Downloads folder listing. */
  title: string;
  /** One line under the title in the folder window. */
  blurb: string;
  /** Everyone in the chat. A group is simply more than two. */
  participants: string[];
  /** Whose messages are "yours" — the green ones. Must appear in `participants`. */
  me: string;
  /** "YYYY-MM-DD". Day 0 of the conversation. */
  startDate: string;
  messages: MockMessage[];
}

export const conversations: MockConversation[] = [
  /* ────────────────────────────────────────────────────────────────────────
     1. Building the portfolio OS — the site this is running inside.
     ──────────────────────────────────────────────────────────────────────── */
  {
    id: 'portfolio-os',
    title: 'Priya — building the OS portfolio',
    blurb: 'Two weeks of arguing about whether a portfolio should boot.',
    participants: ['Rishu', 'Priya'],
    me: 'Rishu',
    startDate: '2026-02-09',
    messages: [
      { from: 'Rishu', at: '21:14', text: 'ok I think I want the portfolio to boot instead of scroll' },
      { from: 'Priya', at: '21:15', text: 'boot how' },
      { from: 'Rishu', at: '21:15', text: 'like an operating system. you land on a desktop, everything is a window' },
      { from: 'Priya', at: '21:17', text: 'that is either the best or the worst idea you have had this year' },
      { from: 'Rishu', at: '21:18', text: 'why not both' },
      { from: 'Priya', at: '21:22', text: 'genuine question though. how does a recruiter find your github in 5 seconds' },
      { from: 'Rishu', at: '21:24', text: 'browser window opens by itself on boot, already on the bio. they never have to touch anything' },
      { from: 'Priya', at: '21:24', text: 'ok that is actually fine then' },

      { from: 'Rishu', at: '18:40', day: 3, text: 'new plan. it boots into 1984 first. black and white, one bit, no colour at all' },
      { from: 'Priya', at: '18:41', text: 'you are adding a SECOND operating system' },
      { from: 'Rishu', at: '18:41', text: 'only for about 3 seconds' },
      { from: 'Rishu', at: '18:42', text: 'then a "software update available" notice drops in, you click install, and it dissolves into the colour one' },
      { from: 'Priya', at: '18:44', text: 'ok the update gag is good. I will allow it' },
      { from: 'Rishu', at: '18:45', omitted: 'image', text: '' },
      { from: 'Priya', at: '18:46', text: 'wait is that dither transition hand written' },
      { from: 'Rishu', at: '18:46', text: 'ordered dither, yeah. it is the same mask coming apart and reforming on the other side' },
      { from: 'Priya', at: '18:47', text: 'showoff' },

      { from: 'Priya', at: '12:03', day: 6, text: 'careful with the apple stuff btw. the happy mac face is theirs, the rainbow logo is theirs' },
      { from: 'Rishu', at: '12:10', text: 'yeah I already pulled both. everything is original now, I just kept the medium — 1 bit, chunky letters, 50% dither' },
      { from: 'Rishu', at: '12:10', text: 'style is not a trademark. a bitten apple is' },
      { from: 'Priya', at: '12:11', text: 'good' },

      { from: 'Rishu', at: '23:51', day: 9, text: 'there is a mascot now. shows up maybe once every couple of minutes, winks, leaves' },
      { from: 'Priya', at: '23:52', text: 'how do I make him appear' },
      { from: 'Rishu', at: '23:52', text: 'you cannot. that is the whole joke' },
      { from: 'Priya', at: '23:53', text: 'there is no key combo? nothing?' },
      { from: 'Rishu', at: '23:53', text: 'no test id, no global, no summon. three separate rolls behind a cooldown and a per session cap' },
      { from: 'Priya', at: '23:54', text: 'so even if someone works out the trigger they still cannot repeat it' },
      { from: 'Rishu', at: '23:54', text: 'exactly that' },
      { from: 'Priya', at: '23:55', text: 'ok fine that is very good', edited: true },
      { from: 'Rishu', at: '23:58', text: 'I will send the link tomorrow' },
    ],
  },

  /* ────────────────────────────────────────────────────────────────────────
     2. WhisperFlow — the native Mac dictation app.
     ──────────────────────────────────────────────────────────────────────── */
  {
    id: 'whisperflow-ship',
    title: 'Dev group — shipping WhisperFlow',
    blurb: 'Code signing, permissions, and why the Mac app is not in the browser.',
    participants: ['Rishu', 'Sam', 'Aditi'],
    me: 'Rishu',
    startDate: '2026-04-02',
    messages: [
      { from: 'system', at: '10:00', text: 'Rishu created group "WhisperFlow"' },
      { from: 'Rishu', at: '10:01', text: 'dictation app is working end to end. hold a hotkey anywhere, talk, the text lands at your cursor' },
      { from: 'Sam', at: '10:03', text: 'anywhere anywhere? like in any app?' },
      { from: 'Rishu', at: '10:03', text: 'any app. that is the accessibility permission, it is the whole reason it has to be native' },
      { from: 'Aditi', at: '10:05', text: 'could it not just be a web page' },
      { from: 'Rishu', at: '10:07', text: 'a web page cannot type into your code editor. it cannot register a global hotkey either. browser sandbox stops both, correctly' },
      { from: 'Aditi', at: '10:07', text: 'fair' },
      { from: 'Rishu', at: '10:08', text: 'it is swift + swiftpm, menu bar only, no dock icon, no window until you click it' },

      { from: 'Sam', at: '15:20', day: 2, text: 'tried to install, mac says unidentified developer and refuses' },
      { from: 'Rishu', at: '15:21', text: 'yeah. system settings > privacy & security > scroll to security > open anyway. once only' },
      { from: 'Sam', at: '15:22', text: 'why is it like this' },
      { from: 'Rishu', at: '15:24', text: 'notarising needs an apple developer membership. $99/year. a self signed cert is not the same thing, gatekeeper treats them completely differently' },
      { from: 'Sam', at: '15:24', text: 'so the alarming warning is just... the price of not paying apple $99' },
      { from: 'Rishu', at: '15:25', text: 'basically yes' },
      { from: 'Aditi', at: '15:31', text: 'worked. the noise suppression is doing a lot of work on my terrible mic' },
      { from: 'Rishu', at: '15:32', text: 'rnnoise, runs locally. the audio never leaves your machine before it is cleaned up' },

      { from: 'Aditi', at: '09:12', day: 5, text: 'where does the transcription actually happen' },
      { from: 'Rishu', at: '09:14', text: 'whisper api by default, but you can point it at any server you host yourself. capture and denoise are always local' },
      { from: 'Aditi', at: '09:15', text: 'and the cleanup pass?' },
      { from: 'Rishu', at: '09:15', text: 'optional llm stage after. it fixes the ums and the punctuation. you can turn it off' },
      { from: 'Sam', at: '09:40', text: 'ignore that, wrong chat', deleted: true },
      { from: 'Rishu', at: '11:02', text: 'putting a demo of it in the portfolio site btw' },
      { from: 'Sam', at: '11:03', text: 'how, you literally just explained it cannot be a web page' },
      { from: 'Rishu', at: '11:05', text: 'the dictation part can — mic in the browser, transcript back, drops straight into the notepad app. the typing-into-any-app part is the bit that stays native' },
      { from: 'Sam', at: '11:05', text: 'ok that is a sensible split' },
      { from: 'Rishu', at: '11:06', text: 'and there is a download link for the real one next to it' },
    ],
  },

  /* ────────────────────────────────────────────────────────────────────────
     3. The chat tool itself. You are reading this inside it.
     ──────────────────────────────────────────────────────────────────────── */
  {
    id: 'chat-exporter',
    title: 'Mum — the chat exporter',
    blurb: 'The tool you are currently looking at, explaining itself.',
    participants: ['Rishu', 'Mum'],
    me: 'Rishu',
    startDate: '2026-05-18',
    messages: [
      { from: 'Mum', at: '08:30', text: 'Can you save our old messages somewhere? I am changing phone and I do not want to lose them' },
      { from: 'Rishu', at: '09:02', text: 'yes. export the chat from whatsapp and send me the zip, I will turn it into a pdf' },
      { from: 'Mum', at: '09:03', text: 'How do I export' },
      { from: 'Rishu', at: '09:04', text: 'open the chat > the three dots > more > export chat. it will ask with or without media, pick with' },
      { from: 'Mum', at: '09:31', omitted: 'document', text: '' },
      { from: 'Rishu', at: '09:40', text: 'perfect that is the one' },

      { from: 'Rishu', at: '20:15', day: 1, text: 'ok I could not find a tool that did this properly so I wrote one' },
      { from: 'Mum', at: '20:16', text: 'Of course you did' },
      { from: 'Rishu', at: '20:17', text: 'it reads the export, lays it out exactly like whatsapp, and gives you a pdf. or a png. or a single html file you can just open' },
      { from: 'Mum', at: '20:18', text: 'Does it go on the internet' },
      { from: 'Rishu', at: '20:19', text: 'no. everything happens inside your browser, nothing is uploaded anywhere. that was the main thing I cared about' },
      { from: 'Mum', at: '20:19', text: 'Good' },
      { from: 'Rishu', at: '20:22', text: 'you can also pick a date range, so if you only want the holiday ones you can cut it to those weeks' },
      { from: 'Mum', at: '20:23', text: 'The ones from Kerala please' },
      { from: 'Rishu', at: '20:23', text: 'on it' },
      { from: 'Rishu', at: '20:41', omitted: 'image', text: '' },
      { from: 'Mum', at: '20:44', text: 'That is exactly it. Thank you beta' },
      { from: 'Mum', at: '20:44', text: 'Can you do the family group as well' },
      { from: 'Rishu', at: '20:45', text: 'that one is 40,000 messages' },
      { from: 'Mum', at: '20:45', text: 'Yes' },
      { from: 'Rishu', at: '20:47', text: 'it will be fine actually. the parsing runs off the main thread and it only draws the rows you can see' },
      { from: 'Rishu', at: '20:47', text: 'give me an hour' },
    ],
  },
];

export default conversations;
