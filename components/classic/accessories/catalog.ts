/**
 * What each desk accessory is called, what it looks like, and how big its
 * window opens — with no reference to the components themselves.
 *
 * OWNER: Classic Boot agent.
 *
 * Split out from the registry on purpose: the Finder-ish disk window lists the
 * accessories, and if it read the registry the registry would import it back.
 */
import {
  ICON_CALCULATOR,
  ICON_CLOCK,
  ICON_CONTROLS,
  ICON_DISK,
  ICON_KEYCAPS,
  ICON_MACHINE,
  ICON_NOTEPAD,
  ICON_PAINT,
  ICON_PUZZLE,
  ICON_SCRAPBOOK,
  ICON_WRITE,
  type PixelMap,
} from '@/components/classic/icons';
import type { AccessoryId } from '@/components/classic/accessories/types';

export interface AccessoryMeta {
  title: string;
  icon: PixelMap;
  width: number;
  height: number;
}

export const ACCESSORY_META: Record<AccessoryId, AccessoryMeta> = {
  'alarm-clock': { title: 'Alarm Clock', icon: ICON_CLOCK, width: 212, height: 200 },
  calculator: { title: 'Calculator', icon: ICON_CALCULATOR, width: 196, height: 268 },
  'control-panel': { title: 'Control Panel', icon: ICON_CONTROLS, width: 292, height: 320 },
  'key-caps': { title: 'Key Caps', icon: ICON_KEYCAPS, width: 296, height: 190 },
  'note-pad': { title: 'Note Pad', icon: ICON_NOTEPAD, width: 236, height: 220 },
  puzzle: { title: 'Puzzle', icon: ICON_PUZZLE, width: 244, height: 306 },
  scrapbook: { title: 'Scrapbook', icon: ICON_SCRAPBOOK, width: 232, height: 268 },
  // The two applications. Everything above is a desk accessory and fits in a
  // couple of hundred pixels; a canvas and a page do not, so these are the only
  // windows on this desktop that ask for real estate.
  // Named for the shell's own Bit* primitives, and not for either of the two
  // programs they are in conversation with — "Mac" anything is a trademark and
  // HANDOFF.md §4.1 is not negotiable.
  paint: { title: 'BitPaint', icon: ICON_PAINT, width: 568, height: 426 },
  write: { title: 'BitWrite', icon: ICON_WRITE, width: 500, height: 434 },
  about: { title: 'About This Machine', icon: ICON_MACHINE, width: 288, height: 232 },
  disk: { title: 'Startup Disk', icon: ICON_DISK, width: 300, height: 216 },
};

/**
 * The desk-accessory menu, in the order it listed them: alphabetically, because
 * there was nothing else to sort by.
 */
export const DESK_ACCESSORIES: readonly AccessoryId[] = [
  'alarm-clock',
  'calculator',
  'control-panel',
  'key-caps',
  'note-pad',
  'puzzle',
  'scrapbook',
] as const;

/**
 * Applications, which are a different kind of thing entirely.
 *
 * A desk accessory was a few kilobytes that lived in the System file and could
 * be pulled down over whatever you were doing. An application was a program on
 * a disk that you launched, and it did not appear in the mark menu. Keeping the
 * two lists apart is the whole reason `AccessoryDef.inDeskMenu` exists.
 */
export const APPLICATIONS: readonly AccessoryId[] = ['paint', 'write'] as const;
