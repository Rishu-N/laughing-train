/**
 * The desk accessory registry.
 *
 * OWNER: Classic Boot agent.
 *
 * Metadata comes from catalog.ts; this file is only the component wiring, so
 * nothing that lists accessories has to import the components themselves.
 */
import type { ComponentType } from 'react';
import AboutMachine from '@/components/classic/accessories/AboutMachine';
import AlarmClock from '@/components/classic/accessories/AlarmClock';
import Calculator from '@/components/classic/accessories/Calculator';
import ClassicPaint from '@/components/classic/accessories/ClassicPaint';
import ClassicWrite from '@/components/classic/accessories/ClassicWrite';
import ControlPanel from '@/components/classic/accessories/ControlPanel';
import DiskWindow from '@/components/classic/accessories/DiskWindow';
import KeyCaps from '@/components/classic/accessories/KeyCaps';
import NotePad from '@/components/classic/accessories/NotePad';
import Puzzle from '@/components/classic/accessories/Puzzle';
import Scrapbook from '@/components/classic/accessories/Scrapbook';
import { ACCESSORY_META, APPLICATIONS } from '@/components/classic/accessories/catalog';
import type {
  AccessoryDef,
  AccessoryId,
  AccessoryProps,
} from '@/components/classic/accessories/types';

const COMPONENTS: Record<AccessoryId, ComponentType<AccessoryProps>> = {
  'alarm-clock': AlarmClock,
  calculator: Calculator,
  'control-panel': ControlPanel,
  'key-caps': KeyCaps,
  'note-pad': NotePad,
  puzzle: Puzzle,
  scrapbook: Scrapbook,
  paint: ClassicPaint,
  write: ClassicWrite,
  about: AboutMachine,
  disk: DiskWindow,
};

/** The two Finder windows, which were never accessories in the first place. */
const FINDER: readonly AccessoryId[] = ['about', 'disk'];

export function accessory(id: AccessoryId): AccessoryDef {
  const meta = ACCESSORY_META[id];
  return {
    id,
    title: meta.title,
    icon: meta.icon,
    width: meta.width,
    height: meta.height,
    // Applications launched off the disk; only accessories hung under the mark.
    inDeskMenu: !FINDER.includes(id) && !APPLICATIONS.includes(id),
    Component: COMPONENTS[id],
  };
}
