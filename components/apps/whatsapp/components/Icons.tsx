// Minimal hand-drawn icon set — inline SVG (no icon-font dependency) so
// these embed correctly in the self-contained HTML export too.
type IconProps = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export function CameraIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13.5" r="3.2" />
    </svg>
  );
}

export function VideoIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <path d="M16 10.5 22 7v10l-6-3.5Z" />
    </svg>
  );
}

export function PlayIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="currentColor" stroke="none">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 8.5v7l6-3.5Z" />
    </svg>
  );
}

export function MicIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

export function DocumentIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M6 2h8l4 4v16H6Z" />
      <path d="M14 2v4h4" />
    </svg>
  );
}

export function StickerIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
      <path d="M8 14.5c1.2 1.3 2.6 2 4 2s2.8-.7 4-2" />
    </svg>
  );
}

export function ContactIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.2-4 4-6 7-6s5.8 2 7 6" />
    </svg>
  );
}

export function PhoneIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M5 4h3l2 5-2 1.3a11 11 0 0 0 5.7 5.7L15 14l5 2v3c0 1-.9 1.8-1.9 1.6C10.5 19.4 4.6 13.5 3.4 6.9 3.2 5.9 4 5 5 5Z" />
    </svg>
  );
}

export function VideoCallIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="2" y="6" width="13" height="11" rx="2" />
      <path d="M15 10 21 7v10l-6-3Z" />
    </svg>
  );
}

export function MissedCallIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M17 7 7 17M7 7l10 10" strokeWidth="2" />
    </svg>
  );
}

export function CheckIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} strokeWidth="2">
      <path d="M4 12l5 5L20 6" />
    </svg>
  );
}

export function DoubleCheckIcon({ size = 15, className }: IconProps) {
  return (
    <svg viewBox="0 0 20 14" width={size} height={(size * 14) / 20} className={className} fill="none">
      <path d="M1 7l4 4L13 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 7l4 4L19 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SearchIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function DownloadIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" />
    </svg>
  );
}

/** Empty-state mark. An original pair of speech bubbles — WhatsApp's own
 * logo is a trademark and is not shipped anywhere in this project. */
export function ChatBubblesIcon({ size = 64, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} strokeWidth="1.4">
      <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h9A2.5 2.5 0 0 1 17 6.5v5A2.5 2.5 0 0 1 14.5 14H8l-4 3v-3.2A2.5 2.5 0 0 1 3 11.5Z" />
      <path d="M19 9.5A2.5 2.5 0 0 1 21 12v4.5a2.5 2.5 0 0 1-2.5 2.5H16l-3 2.5V19" />
    </svg>
  );
}

export function SlidersIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  );
}

export function ListIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function TrashIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </svg>
  );
}
