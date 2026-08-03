import type { HTMLMotionProps } from 'motion/react'
import type { ReactNode, RefObject } from 'react'
import type { PicodashJsonValue, PicodashStore, PicodashStoreState } from '@picodash/store'
import type { PicodashPanelActionMenu } from '../../components/panel/actions/PicodashPanelActions.js'

export type PicodashValue = PicodashJsonValue

export type PicodashPin = 'start' | 'end'
export type PicodashStatus = 'info' | 'warning' | 'alert' | 'error'
export type PicodashControlStateValue = boolean | string | number | null | undefined
export type PicodashControlStates = Record<string, PicodashControlStateValue>

export type AnyPicodashValues = Record<string, PicodashJsonValue>
export type AnyPicodashStore = PicodashStore<AnyPicodashValues>
export type AnyPicodashStoreState = PicodashStoreState<AnyPicodashValues>

export type PicodashPanelCorner = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'

export type PicodashPanelSnappedPosition =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left'

export type PicodashPanelDockedPosition =
  | PicodashPanelCorner
  | 'full-left'
  | 'full-right'
  | 'middle-left'
  | 'middle-right'

export type PicodashPanelHybridDockPosition = PicodashPanelCorner | 'full-left' | 'full-right'

export type PicodashPanelFreeDisposition = { kind: 'free' }
export type PicodashPanelSnappedDisposition<
  Position extends PicodashPanelSnappedPosition = PicodashPanelSnappedPosition,
> = {
  kind: 'snapped'
  position: Position
}
export type PicodashPanelDockedDisposition<
  Position extends PicodashPanelDockedPosition = PicodashPanelDockedPosition,
> = {
  kind: 'docked'
  position: Position
}

export type PicodashPanelPlacement =
  | {
      disposition: PicodashPanelFreeDisposition | PicodashPanelSnappedDisposition
      mode: 'floating'
    }
  | {
      disposition: PicodashPanelDockedDisposition
      mode: 'fixed'
    }
  | {
      disposition:
        | PicodashPanelFreeDisposition
        | PicodashPanelSnappedDisposition<'bottom' | 'top'>
        | PicodashPanelDockedDisposition<PicodashPanelHybridDockPosition>
      mode: 'hybrid'
    }

export type PicodashPanelDefaultPlacement = PicodashPanelPlacement

export interface PicodashPanelPlacementOptions {
  detachThresholdMultiplier?: number
  snapOffset?: number
  snapProximity?: number
}

export type PicodashPanelBoundary = Element | RefObject<Element | null>
export type PicodashPanelCloseBehavior = 'deregister' | 'hide'

export interface PicodashPanelCloseOptions {
  behavior: PicodashPanelCloseBehavior
}

export interface PicodashPanelCloseDetails {
  behavior: PicodashPanelCloseBehavior
  panelId: string
}

interface PicodashPanelBaseProps extends Omit<
  HTMLMotionProps<'aside'>,
  'children' | 'dragConstraints' | 'id' | 'onClose' | 'title'
> {
  /**
   * Omit to render the built-in actions. Pass false to remove the menu, an array to replace its
   * rows under the default ellipsis trigger, or an ActionSubmenu to replace the root trigger and
   * menu together.
   */
  actionMenu?: PicodashPanelActionMenu
  children?: ReactNode
  /** Render children directly when the Panel is used without a Dashlist. */
  contentMode?: 'dashlist' | 'plain'
  boundary?: PicodashPanelBoundary | null
  close?: boolean | PicodashPanelCloseOptions
  collapsible?: boolean
  defaultCollapsed?: boolean
  defaultPlacement?: PicodashPanelDefaultPlacement
  defaultVisible?: boolean
  onClose?: (details: PicodashPanelCloseDetails) => void
  placementOptions?: PicodashPanelPlacementOptions
  theme?: string
  title?: ReactNode
  width?: number | string
}

export type PicodashPanelProps<TValues extends object = AnyPicodashValues> =
  PicodashPanelBaseProps & {
    store: PicodashStore<TValues>
  }

export interface PicodashGroupContextValue {
  beginItemReorder: (
    itemId: string,
    pointerY: number,
    pointerId: number,
    setVisualOffset: (offset: number) => void,
  ) => void
  beginKeyboardReorder: (itemId: string, label: string) => void
  cancelKeyboardReorder: (itemId: string) => void
  commitPendingOrder: () => void
  commitKeyboardReorder: (itemId: string) => void
  dragConstraintsRef: RefObject<HTMLDivElement | null>
  keyboardAnnouncement: { itemId: string; message: string } | null
  keyboardReorderItemId: string | null
  listRef: RefObject<HTMLDivElement | null>
  moveKeyboardReorder: (itemId: string, direction: -1 | 1) => void
  parentId: string
  registerItemMotion: (itemId: string, motion: PicodashReorderItemMotion) => () => void
}

export interface PicodashReorderItemLayout {
  id: string
  max: number
  min: number
}

export interface PicodashReorderItemMotion {
  animateFrom: (offset: number) => void
  getOffset: () => number
}
