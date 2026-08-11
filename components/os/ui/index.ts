/**
 * Shared OS UI primitives.
 *
 * READ-ONLY for Phase 1 agents. Import everything from '@/components/os/ui'.
 * If a primitive you need is missing, ask the coordinator rather than building a
 * one-off — five apps each inventing their own beveled button is the exact
 * failure this barrel exists to prevent.
 */
export { Button, IconButton } from './Button';
export type { ButtonProps, IconButtonProps } from './Button';

export { Dialog, ConfirmDialog } from './Dialog';
export type { DialogProps, ConfirmDialogProps } from './Dialog';

export {
  Toolbar,
  ToolbarSeparator,
  ToolbarSpacer,
  ToolbarLabel,
  StatusBar,
} from './Toolbar';

export { TextField, Select, Checkbox, Radio, Field, FieldGroup } from './Field';

export { MenuList, MenuItem, MenuSeparator, MenuHeading } from './MenuList';
export type { MenuItemProps } from './MenuList';

export { AppFrame, AppSidebar } from './AppFrame';
export type { AppFrameProps } from './AppFrame';
