'use client';

/**
 * The classic shell's tiny "system": open a desk accessory, put up an alert,
 * change the desktop pattern.
 *
 * OWNER: Classic Boot agent.
 *
 * Deliberately React context rather than a module-level store: the shell can be
 * remounted (Restart from the colour OS comes back here), and a store that
 * outlives the mount would bring the previous visit's open windows with it.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { AccessoryId } from '@/components/classic/accessories/types';

export interface ClassicSystem {
  /** Open a desk accessory, or bring it to the front if it is already up. */
  open: (id: AccessoryId) => void;
  close: (id: AccessoryId) => void;
  /** Put up a modal 1-bit alert. */
  alert: (title: string, message: ReactNode) => void;

  /** Desktop pattern index into PATTERNS. The Control Panel really sets this. */
  pattern: number;
  setPattern: (index: number) => void;

  /** Menu-bar clock, also a real Control Panel setting. */
  menuClock: boolean;
  setMenuClock: (on: boolean) => void;

  /** Bring the Software Update notification back after "Later". */
  showUpdate: () => void;
}

const ClassicSystemContext = createContext<ClassicSystem | null>(null);

export function ClassicSystemProvider({
  value,
  children,
}: {
  value: ClassicSystem;
  children: ReactNode;
}) {
  return (
    <ClassicSystemContext.Provider value={value}>
      {children}
    </ClassicSystemContext.Provider>
  );
}

export function useClassicSystem(): ClassicSystem {
  const ctx = useContext(ClassicSystemContext);
  if (!ctx) {
    throw new Error('useClassicSystem must be used inside the classic shell');
  }
  return ctx;
}
