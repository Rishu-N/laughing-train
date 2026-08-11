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
  ICON_PUZZLE,
  ICON_SCRAPBOOK,
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
