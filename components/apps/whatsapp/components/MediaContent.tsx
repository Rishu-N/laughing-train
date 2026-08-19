import { useEffect, useState } from "react";
import { MsgType, Flag } from "../lib/model";
import { formatFileSize } from "../lib/format";
import { useObjectUrl } from "../hooks/useObjectUrl";
import { useLightbox } from "../state/LightboxContext";
import {
  CameraIcon,
  VideoIcon,
  PlayIcon,
  MicIcon,
  DocumentIcon,
  StickerIcon,
  ContactIcon,
  DownloadIcon,
} from "./Icons";

const PLACEHOLDER: Partial<Record<MsgType, { icon: React.ReactNode; label: string }>> = {
  [MsgType.IMAGE]: { icon: <CameraIcon />, label: "Photo" },
  [MsgType.VIDEO]: { icon: <VideoIcon />, label: "Video" },
  [MsgType.STICKER]: { icon: <StickerIcon />, label: "Sticker" },
  [MsgType.AUDIO]: { icon: <MicIcon />, label: "Voice message" },
  [MsgType.DOCUMENT]: { icon: <DocumentIcon />, label: "Document" },
  [MsgType.GIF]: { icon: <PlayIcon />, label: "GIF" },
  [MsgType.CONTACT]: { icon: <ContactIcon />, label: "Contact card" },
};

function PlaceholderTile({ type }: { type: MsgType }) {
  const info = PLACEHOLDER[type] ?? { icon: <DocumentIcon />, label: "Media" };
  return (
    <div className="media-placeholder">
      <div className="media-placeholder-icon">{info.icon}</div>
      <span>{info.label} not included in this export</span>
    </div>
  );
}

function ContactCardTile({ blob, filename }: { blob: Blob; filename: string }) {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    blob.text().then((text) => {
      if (cancelled) return;
      const m = /FN:(.+)/i.exec(text);
      setName(m ? m[1].trim() : null);
    });
    return () => {
      cancelled = true;
    };
  }, [blob]);
  return (
    <div className="media-placeholder contact-tile">
      <div className="media-placeholder-icon">
        <ContactIcon />
      </div>
      <span>{name ?? filename}</span>
    </div>
  );
}

export function MediaContent({
  type,
  flags,
  mediaKey,
  caption,
  blob,
}: {
  type: MsgType;
  flags: number;
  mediaKey: string | null;
  caption: string;
  blob: Blob | undefined;
}) {
  const hasFile = (flags & Flag.HAS_FILE) !== 0 && !!blob;
  const url = useObjectUrl(hasFile ? blob : undefined);
  const lightbox = useLightbox();

  if (!hasFile || !url) {
    return (
      <>
        <PlaceholderTile type={type} />
        {caption && <div className="bubble-caption">{caption}</div>}
      </>
    );
  }

  if (type === MsgType.IMAGE) {
    return (
      <>
        {/* Every src in this file is a blob: object URL minted from IndexedDB
            at render time. next/image has no origin to fetch and no intrinsic
            size to work from, so <img> is the right element, not a shortcut. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="media-image"
          src={url}
          alt={caption || "Photo"}
          loading="lazy"
          onClick={() => lightbox.open({ url, kind: "image" })}
        />
        {caption && <div className="bubble-caption">{caption}</div>}
      </>
    );
  }

  if (type === MsgType.STICKER) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="media-sticker" src={url} alt="Sticker" loading="lazy" />;
  }

  if (type === MsgType.VIDEO || type === MsgType.GIF) {
    return (
      <>
        <video
          className="media-video"
          src={url}
          controls={type === MsgType.VIDEO}
          autoPlay={type === MsgType.GIF}
          loop={type === MsgType.GIF}
          muted={type === MsgType.GIF}
          playsInline
          preload="metadata"
        />
        {caption && <div className="bubble-caption">{caption}</div>}
      </>
    );
  }

  if (type === MsgType.AUDIO) {
    return <audio className="media-audio" src={url} controls preload="metadata" />;
  }

  if (type === MsgType.CONTACT) {
    return <ContactCardTile blob={blob!} filename={mediaKey ?? "Contact"} />;
  }

  // DOCUMENT and anything else with a resolved file.
  return (
    <a className="media-document" href={url} download={mediaKey ?? "file"}>
      <div className="media-document-icon">
        <DocumentIcon />
      </div>
      <div className="media-document-info">
        <div className="media-document-name">{mediaKey}</div>
        <div className="media-document-size">{formatFileSize(blob!.size)}</div>
      </div>
      <DownloadIcon className="media-document-download" />
    </a>
  );
}
