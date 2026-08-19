import { useLightbox } from "../state/LightboxContext";

export function Lightbox() {
  const { item, close } = useLightbox();
  if (!item) return null;
  return (
    <div className="lightbox-backdrop" onClick={close}>
      <button className="lightbox-close" onClick={close} title="Close">
        ✕
      </button>
      {item.kind === "image" ? (
        // next/image cannot handle these: the src is a blob: object URL minted
        // from IndexedDB at render time, with no origin for the optimizer to
        // fetch and no width known ahead of time. A plain <img> is the correct
        // element here, not a shortcut.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.url} alt="" onClick={(e) => e.stopPropagation()} />
      ) : (
        <video src={item.url} controls autoPlay onClick={(e) => e.stopPropagation()} />
      )}
    </div>
  );
}
