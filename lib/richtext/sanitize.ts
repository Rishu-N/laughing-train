/**
 * The one HTML sanitiser on this machine.
 *
 * Two word processors restore their document by assigning `innerHTML`: the
 * colour OS's Word and the 1984 shell's BitWrite. There is no
 * `dangerouslySetInnerHTML` anywhere in this repo and there is not going to be,
 * so those two assignments are the entire surface — and localStorage is
 * writable by anything that ever runs on this origin, which means what comes
 * back out is not trusted merely because we were the ones who put it in.
 *
 * WHY IT LIVES HERE and not inside either app:
 *
 * the two shells are separate worlds on purpose (HANDOFF.md §5.2) — the 1984
 * shell shares no primitive with System 7 and reaches into `components/os/ui`
 * for nothing. Having BitWrite import the colour OS's rich-text module, or
 * Word import `lib/classic/write.ts`, would cut a seam through that wall for
 * the sake of one function. But keeping a copy on each side is precisely how
 * the repo came to hold two standards for the same risk, the older of them the
 * weaker. So the wall stays up and the logic moves *underneath* both of them:
 * `lib/` is already where shell-agnostic logic lives, this module imports
 * nothing at all, and each app re-exports it from its own rich-text file. That
 * way neither shell's import graph ever learns the other one exists.
 *
 * The method is the boring one, which is the only kind worth trusting. Parse
 * into a detached `<template>`: nothing inside one is ever live, so no script
 * runs and no image fetches while we are deciding what to keep. Then walk it
 * with an allowlist of elements and an allowlist of attributes — a denylist is
 * a promise you have thought of every tag anyone will ever invent, and nobody
 * has.
 */

const HTML_NS = 'http://www.w3.org/1999/xhtml';

/**
 * What a document may contain. A superset of what either editor can produce on
 * its own, because both accept a paste and neither should silently eat a
 * heading or a table on the way back in.
 */
const ALLOWED_TAGS: ReadonlySet<string> = new Set([
  // Inline
  'A', 'ABBR', 'B', 'BIG', 'BR', 'CITE', 'CODE', 'DEL', 'EM', 'FONT', 'I',
  'INS', 'KBD', 'MARK', 'Q', 'S', 'SAMP', 'SMALL', 'SPAN', 'STRIKE', 'STRONG',
  'SUB', 'SUP', 'TT', 'U', 'VAR', 'WBR',
  // Block
  'BLOCKQUOTE', 'CENTER', 'DD', 'DIV', 'DL', 'DT', 'H1', 'H2', 'H3', 'H4',
  'H5', 'H6', 'HR', 'LI', 'OL', 'P', 'PRE', 'UL',
  // Table
  'CAPTION', 'COL', 'COLGROUP', 'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH',
  'THEAD', 'TR',
]);

/**
 * Elements deleted outright, children and all, rather than unwrapped.
 *
 * Everything else that fails the allowlist is unwrapped — a stripped tag should
 * not take a paragraph of somebody's writing away with it. These are the
 * exceptions, and they are exceptions for two different reasons. Some load a
 * resource or carry metadata, so their contents are not prose and keeping them
 * as text is just litter (`<link>`, `<iframe>`, `<object>`). The rest parse as
 * raw or escapable-raw text, which means their contents were never markup and
 * unwrapping them would drop a lump of unparsed source into the document — the
 * shape of every mutation-XSS trick ever written. Deleting them keeps what we
 * serialise and what a browser re-parses the same document.
 */
const DROPPED_WHOLE: ReadonlySet<string> = new Set([
  'BASE', 'EMBED', 'FRAME', 'FRAMESET', 'HEAD', 'IFRAME', 'LINK', 'META',
  'NOEMBED', 'NOFRAMES', 'NOSCRIPT', 'OBJECT', 'PLAINTEXT', 'SCRIPT', 'STYLE',
  'TEMPLATE', 'TEXTAREA', 'TITLE', 'XMP',
]);

/** CSS that can fetch, or that older engines would run. */
const UNSAFE_STYLE = /(url\s*\(|expression\s*\(|javascript:|@import|behaviou?r\s*:)/i;

/**
 * Schemes a link may carry: the two web ones, mail, a same-document fragment,
 * and a same-origin path. Note `\/(?!\/)`, which admits `/about` and refuses
 * `//evil.example` — a protocol-relative URL is not a path.
 */
const SAFE_HREF = /^(?:https?:|mailto:|#|\.{0,2}\/|\/(?!\/))/i;

/**
 * The HTML parser ignores control characters and whitespace inside a scheme, so
 * `java\tscript:` reaches the DOM as an attribute value that a naive prefix test
 * reads as safe and a browser reads as script. Strip them before testing, which
 * is the only comparison worth making.
 */
function isSafeHref(value: string): boolean {
  return SAFE_HREF.test(value.replace(/[\u0000-\u0020]+/g, ''));
}

function keepAttribute(tag: string, name: string, value: string): boolean {
  switch (name) {
    case 'style':
      return !UNSAFE_STYLE.test(value);
    case 'align':
      return true;
    case 'dir':
      return value === 'ltr' || value === 'rtl' || value === 'auto';
    case 'href':
      return tag === 'A' && isSafeHref(value);
    case 'color':
    case 'face':
    case 'size':
      return tag === 'FONT';
    case 'colspan':
    case 'rowspan':
      return tag === 'TD' || tag === 'TH';
    case 'start':
      return tag === 'OL';
    default:
      // Everything unnamed above, which is where every `on*` handler lives.
      return false;
  }
}

function scrub(node: ParentNode): void {
  // A live HTMLCollection would shift under us the moment a child is unwrapped.
  for (const child of Array.from(node.children)) {
    const tag = child.tagName.toUpperCase();

    // Foreign content first. An `<svg>` or `<math>` subtree re-parses under
    // different rules than the ones it was serialised under, which is a whole
    // family of bugs this document has no use for anyway.
    if (child.namespaceURI !== HTML_NS || DROPPED_WHOLE.has(tag)) {
      child.remove();
      continue;
    }

    scrub(child);

    if (!ALLOWED_TAGS.has(tag)) {
      child.replaceWith(...Array.from(child.childNodes));
      continue;
    }

    for (const attr of Array.from(child.attributes)) {
      if (!keepAttribute(tag, attr.name.toLowerCase(), attr.value)) {
        child.removeAttribute(attr.name);
      }
    }
  }
}

/** Scrub stored HTML on its way back into an editor. Returns '' on the server. */
export function sanitizeStoredHtml(html: string): string {
  if (typeof document === 'undefined') return '';
  const template = document.createElement('template');
  template.innerHTML = html;
  scrub(template.content);
  return template.innerHTML;
}
