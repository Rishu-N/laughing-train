/**
 * Everything WhisperFlow says about itself, in one place.
 *
 * It lives here rather than in content/ on purpose: content/ is the owner's
 * bio, projects and facts, and this is app copy describing one specific piece
 * of software — the same category as the terminal's command help. It is still
 * kept out of the JSX so a wording change is one edit in one file, and so the
 * components stay readable.
 *
 * Sourced from the WhisperFlow repository's own README. If the real app changes,
 * this is the file that goes stale.
 */

export interface Capability {
  title: string;
  detail: string;
}

export const WHISPERFLOW = {
  name: 'WhisperFlow',
  tagline: 'A menu-bar dictation app for macOS.',

  /** What the real thing is. Two short paragraphs, the way the README opens. */
  summary: [
    'Press a shortcut anywhere, speak, and the text lands at your cursor and on your clipboard. There is no Dock icon and no window until you click the microphone in the menu bar.',
    'Audio capture, noise suppression and encoding all happen on the machine. Transcription goes to OpenAI’s Whisper API, or to any server you host yourself. An optional LLM stage then cleans the transcript up.',
  ],

  requires: 'macOS 15 (Sequoia) or later. Apple Silicon or Intel.',
  hotkey: '⌥ ⌘ Space',
  scale: '8,923 lines of Swift across 44 files, plus vendored C for the denoiser.',

  repoUrl: 'https://github.com/Rishu-N/super-whisper',
  releaseUrl: 'https://github.com/Rishu-N/super-whisper/releases/latest',
  installCommand:
    'curl -fsSL https://raw.githubusercontent.com/Rishu-N/super-whisper/main/install.sh | bash',

  /**
   * The honest part. Each of these is a browser sandbox boundary, not a missing
   * feature — a web page genuinely cannot do any of them, and it should not be
   * able to.
   */
  nativeOnly: [
    {
      title: 'A global hotkey',
      detail:
        'The Mac app registers ⌥⌘Space system-wide through Carbon, so it fires while you are in any other application. A web page only receives keys while its own tab has focus.',
    },
    {
      title: 'Typing at your cursor',
      detail:
        'It synthesises the keystrokes and reads the focused text field through Accessibility, so dictation lands in Mail, or Xcode, or wherever you were. A browser tab cannot type into another application, which is the whole point of the sandbox.',
    },
    {
      title: 'Local noise suppression',
      detail:
        'Apple Voice Processing and Xiph’s RNNoise run on the raw audio before it is ever uploaded. Nothing like that is attempted here.',
    },
    {
      title: 'LLM cleanup',
      detail:
        'An optional second pass rewrites filler words and false starts out of the transcript, with a library of prompts you can edit. Off by default in the Mac app, and not built here.',
    },
  ] satisfies Capability[],

  /** What macOS asks for on first run, and why. */
  permissions: [
    { name: 'Microphone', why: 'to hear you. Prompted on the first dictation.' },
    {
      name: 'Accessibility',
      why: 'to type the text into whatever app you are using. Prompted on the first insertion — decline it and dictation still works, into WhisperFlow’s own window.',
    },
  ],

  /** The click-only install path from the README, condensed. */
  installSteps: [
    'Download the disk image from the latest release, or run the one-line installer below.',
    'Drag WhisperFlow onto Applications, then open it.',
    'macOS will refuse the first launch and mention an unidentified developer — that means the app is not signed with a paid Apple certificate, not that anything is wrong. Approve it once under System Settings → Privacy & Security → Open Anyway.',
    'Click the microphone in the menu bar, open the gear, and paste an OpenAI API key under Server. That is the only required setting.',
    'Hold ⌥ ⌘ Space anywhere, speak, and let go.',
  ],

  /** What the in-OS version actually is. Said out loud, in the app. */
  disclaimer:
    'This window is a demonstration of the dictation half — record, transcribe, hand the text somewhere useful. It is not the shipped product, and it cannot become it: the parts that make WhisperFlow worth installing are exactly the parts a browser is not allowed to do.',
} as const;
