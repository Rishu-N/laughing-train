import { MsgType, Flag, MEDIA_TYPES, type ChatModel } from "../lib/model";
import { formatTime, colorForSender } from "../lib/format";
import { linkify } from "../lib/linkify";
import { MediaContent } from "./MediaContent";
import { PhoneIcon, VideoCallIcon, MissedCallIcon, DoubleCheckIcon } from "./Icons";

export function SystemBubble({ text }: { text: string }) {
  return (
    <div className="row-system">
      <div className="bubble-system">{text}</div>
    </div>
  );
}

export function Bubble({
  model,
  index,
  meId,
  mediaBlobs,
  showTimestamps,
  showSenderName,
  tail,
}: {
  model: ChatModel;
  index: number;
  meId: number;
  mediaBlobs: Map<string, Blob>;
  showTimestamps: boolean;
  showSenderName: boolean;
  /** True for the first message in a run of consecutive same-sender
   * messages — WhatsApp only draws the little corner tail there and
   * groups the rest tightly underneath. */
  tail: boolean;
}) {
  // Uint8Array indexing yields a plain `number`; MsgType's precise union
  // can't be encoded in the typed array itself, so it's asserted at the
  // one place a raw column value becomes a "message".
  const type = model.type[index] as MsgType;
  const flags = model.flags[index];
  const senderId = model.senderId[index];
  const outgoing = senderId === meId;
  const senderName = model.senders[senderId] ?? "Unknown";
  const body = model.bodies[index];
  const isMedia = MEDIA_TYPES.has(type);
  const bare = type === MsgType.STICKER; // stickers render without a bubble shell

  const meta = (
    <span className="bubble-meta">
      {(flags & Flag.EDITED) !== 0 && <span className="bubble-edited">edited</span>}
      {showTimestamps && <span className="bubble-time">{formatTime(model.ts[index])}</span>}
      {outgoing && type !== MsgType.SYSTEM && <DoubleCheckIcon className="bubble-ticks" />}
    </span>
  );

  const side = outgoing ? "out" : "in";
  const tailClass = tail ? "tail" : "no-tail";

  if (type === MsgType.DELETED) {
    return (
      <div className={`row ${side}`}>
        <div className={`bubble deleted ${side} ${tailClass}`}>
          <span className="deleted-icon">🚫</span> This message was deleted
          {meta}
        </div>
      </div>
    );
  }

  if (type === MsgType.CALL) {
    const missed = (flags & Flag.MISSED) !== 0;
    const isVideo = /video/i.test(body);
    return (
      <div className={`row ${side}`}>
        <div className={`bubble call ${side} ${tailClass}`}>
          <span className={`call-icon${missed ? " missed" : ""}`}>
            {missed ? <MissedCallIcon /> : isVideo ? <VideoCallIcon /> : <PhoneIcon />}
          </span>
          <span>{body}</span>
          {meta}
        </div>
      </div>
    );
  }

  if (isMedia) {
    const blob = model.mediaKey[index] ? mediaBlobs.get(model.mediaKey[index]!) : undefined;
    if (bare) {
      return (
        <div className={`row ${side}`}>
          <div className="sticker-wrap">
            <MediaContent
              type={type}
              flags={flags}
              mediaKey={model.mediaKey[index]}
              caption={body}
              blob={blob}
            />
            <span className="sticker-time">{showTimestamps ? formatTime(model.ts[index]) : ""}</span>
          </div>
        </div>
      );
    }
    return (
      <div className={`row ${side}`}>
        <div className={`bubble media ${side} ${tailClass}`}>
          {showSenderName && !outgoing && (
            <div className="bubble-sender" style={{ color: colorForSender(senderName) }}>
              {senderName}
            </div>
          )}
          <MediaContent
            type={type}
            flags={flags}
            mediaKey={model.mediaKey[index]}
            caption={body}
            blob={blob}
          />
          {meta}
        </div>
      </div>
    );
  }

  // TEXT
  return (
    <div className={`row ${side}`}>
      <div className={`bubble text ${side} ${tailClass}`}>
        {showSenderName && !outgoing && (
          <div className="bubble-sender" style={{ color: colorForSender(senderName) }}>
            {senderName}
          </div>
        )}
        <span className="bubble-text">{linkify(body)}</span>
        {meta}
      </div>
    </div>
  );
}
