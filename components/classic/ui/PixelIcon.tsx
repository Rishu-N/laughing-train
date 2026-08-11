'use client';

/**
 * Renders a 16×16 pixel map from icons.ts as a crisp, scalable bitmap.
 *
 * OWNER: Classic Boot agent. Not a System 7 primitive — the classic shell
 * deliberately builds its own 1-bit widgets (see CONTRACT-PHASE3.md §5).
 *
 * Fill is `currentColor` so an icon inverts for free inside a selected menu
 * row or a pressed button, which is exactly how a 1-bit UI shows state.
 */
import { useMemo } from 'react';
import { runs, type PixelMap } from '@/components/classic/icons';

export interface PixelIconProps {
  map: PixelMap;
  /** Rendered edge length in px. Multiples of 16 stay pixel-perfect. */
  size?: number;
  className?: string;
}

export default function PixelIcon({ map, size = 32, className }: PixelIconProps) {
  const rects = useMemo(() => runs(map), [map]);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ display: 'block' }}
    >
      {rects.map((r) => (
        <rect
          key={`${r.x}-${r.y}-${r.width}`}
          x={r.x}
          y={r.y}
          width={r.width}
          height={1}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
