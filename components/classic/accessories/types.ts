/**
 * Shapes shared by the desk accessories.
 *
 * OWNER: Classic Boot agent.
 *
 * Kept free of component imports so the registry can pull components in
 * without anything importing back into it.
 */
import type { ComponentType } from 'react';
import type { PixelMap } from '@/components/classic/icons';

/**
 * The desk accessories that shipped with System 1.0, plus the two Finder
 * windows this shell needs. Deliberately no web browser — the web did not
 * exist in 1984, and its absence is part of the joke.
 */
export type AccessoryId =
  | 'alarm-clock'
  | 'calculator'
  | 'control-panel'
  | 'key-caps'
  | 'note-pad'
  | 'puzzle'
  | 'scrapbook'
  | 'about'
  | 'disk';

export interface AccessoryProps {
  onClose: () => void;
}

export interface AccessoryDef {
  id: AccessoryId;
  title: string;
  icon: PixelMap;
  /** Desktop window size. Narrow layout ignores this and goes full width. */
  width: number;
  height: number;
  /** Listed under the mark menu's desk-accessory group. */
  inDeskMenu: boolean;
  Component: ComponentType<AccessoryProps>;
}
