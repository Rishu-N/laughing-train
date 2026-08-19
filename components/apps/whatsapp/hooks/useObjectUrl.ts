import { useEffect, useMemo } from "react";

/**
 * Creates an object URL for a Blob only while the component holding it is
 * mounted, and revokes it on unmount/blob-change. Combined with
 * virtualization (media components only mount when scrolled into view),
 * this is what keeps a chat with thousands of photos from pinning
 * thousands of decoded images in memory at once.
 */
export function useObjectUrl(blob: Blob | undefined): string | undefined {
  // Derived, not stateful. The obvious version holds the URL in state and sets
  // it from an effect, but that renders once with `undefined` before the image
  // can appear — a visible flash on every tile that scrolls into view — and it
  // trips the set-state-in-effect rule. Memoising gives the URL on the first
  // render and leaves the effect with nothing to do but clean up.
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : undefined), [blob]);

  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return url;
}
