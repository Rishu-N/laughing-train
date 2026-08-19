import { Fragment } from "react";

const URL_RE = /(https?:\/\/[^\s]+)/g;

/** Splits text on URLs and returns them as real anchors, preserving line
 * breaks. Used by the live chat view; the canvas export engine does its
 * own equivalent since it can't render <a> tags.
 *
 * `String.split` with a single-capture-group regex interleaves the
 * captured matches at odd indices — used instead of re-testing each part
 * against `URL_RE`, since that regex is `/g` and stateful `.test()` calls
 * against a shared global regex silently give wrong results every other
 * call (lastIndex carries over between invocations). */
export function linkify(text: string): React.ReactNode {
  return text.split("\n").map((line, li, lines) => {
    const parts = line.split(URL_RE);
    return (
      <Fragment key={li}>
        {parts.map((part, pi) =>
          pi % 2 === 1 ? (
            <a key={pi} href={part} target="_blank" rel="noreferrer noopener">
              {part}
            </a>
          ) : (
            <Fragment key={pi}>{part}</Fragment>
          ),
        )}
        {li < lines.length - 1 && <br />}
      </Fragment>
    );
  });
}
