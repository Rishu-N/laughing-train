/**
 * Tiny 12x12 glyphs for the Paint tool palette. Drawn on a 12-unit grid so the
 * strokes land on whole pixels and read as a bitmap toolbar.
 */
import type { ReactElement } from 'react';

function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      shapeRendering="crispEdges"
    >
      {children}
    </svg>
  );
}

export const TOOL_GLYPHS: Record<string, ReactElement> = {
  pencil: (
    <Glyph>
      <path d="M2.5 9.5l1-2.5 5-5 1.5 1.5-5 5-2.5 1z" fill="currentColor" stroke="none" />
      <path d="M8 2.5l1.5 1.5" />
    </Glyph>
  ),
  brush: (
    <Glyph>
      <path d="M3 10c0-2 1-3 2.5-3l1.5 1.5C7 10 5 10.5 3 10z" fill="currentColor" stroke="none" />
      <path d="M6 6.5l4-4 1.5 1.5-4 4z" fill="currentColor" stroke="none" />
    </Glyph>
  ),
  eraser: (
    <Glyph>
      <path d="M2 8l4-5h4l-4 5z" fill="currentColor" stroke="none" />
      <path d="M2 8h4l4-5" />
      <path d="M1.5 10.5h9" />
    </Glyph>
  ),
  line: (
    <Glyph>
      <path d="M2 10L10 2" />
      <rect x="1" y="9" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="9" y="1" width="2" height="2" fill="currentColor" stroke="none" />
    </Glyph>
  ),
  rect: (
    <Glyph>
      <rect x="1.5" y="2.5" width="9" height="7" />
    </Glyph>
  ),
  rectFilled: (
    <Glyph>
      <rect x="1.5" y="2.5" width="9" height="7" fill="currentColor" />
    </Glyph>
  ),
  oval: (
    <Glyph>
      <ellipse cx="6" cy="6" rx="4.5" ry="3.5" />
    </Glyph>
  ),
  ovalFilled: (
    <Glyph>
      <ellipse cx="6" cy="6" rx="4.5" ry="3.5" fill="currentColor" />
    </Glyph>
  ),
  bucket: (
    <Glyph>
      <path d="M2.5 5.5l4-4 4 4-4 4z" />
      <path d="M9.5 7.5c1 1.5 1.5 2 1.5 2.5a1.2 1.2 0 01-2.4 0c0-.5.5-1 .9-2.5z" fill="currentColor" stroke="none" />
    </Glyph>
  ),
  text: (
    <Glyph>
      <path d="M2 10L6 2l4 8" />
      <path d="M3.5 7.5h5" />
    </Glyph>
  ),
  select: (
    <Glyph>
      <rect x="1.5" y="2.5" width="9" height="7" strokeDasharray="2 1.5" />
    </Glyph>
  ),
};

export const ACTION_GLYPHS: Record<string, ReactElement> = {
  undo: (
    <Glyph>
      <path d="M3 6h4.5A2.5 2.5 0 0110 8.5v0" />
      <path d="M5 4L3 6l2 2" />
    </Glyph>
  ),
};
