// Tiny standalone context for the full-screen image/video preview — kept
// separate from AppContext since it's pure UI state unrelated to chat
// data, and any component several levels deep under ChatView needs to
// reach it without threading a callback prop through every layer.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface LightboxItem {
  url: string;
  kind: "image" | "video";
}

interface Ctx {
  item: LightboxItem | null;
  open: (item: LightboxItem) => void;
  close: () => void;
}

const LightboxContext = createContext<Ctx | null>(null);

export function LightboxProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<LightboxItem | null>(null);
  const open = useCallback((i: LightboxItem) => setItem(i), []);
  const close = useCallback(() => setItem(null), []);
  const value = useMemo(() => ({ item, open, close }), [item, open, close]);
  return <LightboxContext.Provider value={value}>{children}</LightboxContext.Provider>;
}

export function useLightbox(): Ctx {
  const ctx = useContext(LightboxContext);
  if (!ctx) throw new Error("useLightbox must be used within LightboxProvider");
  return ctx;
}
