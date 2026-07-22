import type { HTMLMotionProps } from 'motion/react'
import type { ReactNode, RefObject } from 'react'
import type { StoreApi } from 'zustand'
import type {
  PicodashConstraintRepair,
  PicodashFieldOutput,
  PicodashParser,
  PicodashValidator,
  PicodashWriteResult,
} from './picodash-validation.js'

export type PicodashValue =
  | string
  | number
  | boolean
  | null
  | PicodashValue[]
  | { [key: string]: PicodashValue }

export type PicodashPin = 'start' | 'end'
export type PicodashItemKind = 'control' | 'group'
export type PicodashStatus = 'info' | 'warning' | 'alert' | 'error'
export type PicodashControlStateValue = boolean | string | number | null | undefined
export type PicodashControlStates = Record<string, PicodashControlStateValue>

export interface PicodashFieldState {
  defaultValue?: PicodashValue
  dirty: boolean
  draftValue?: unknown
  errors: string[]
  touched: boolean
}

export interface PicodashItemRegistration {
  collapsible?: boolean
  defaultCollapsed?: boolean
  defaultValue?: PicodashValue
  field?: string
  hidden?: boolean
  id: string
  kind: PicodashItemKind
  label?: string
  parentId: string
  parse?: PicodashParser
  pin?: PicodashPin
  reorderable: boolean
  validate?: PicodashValidator
  valueMode?: 'display' | 'input'
}

export interface PicodashInteractionState {
  activeIds: Record<string, true>
  draggingId: string | null
  focusedId: string | null
  hoveredId: string | null
}

export interface PicodashRepairProposal {
  changes: readonly PicodashConstraintRepair[]
  source: 'constraint' | 'default' | 'initial'
  token: number
}

export interface PicodashPanelState {
  collapsedGroups: Record<string, boolean>
  fields: Record<string, PicodashFieldState>
  interaction: PicodashInteractionState
  items: Record<string, PicodashItemRegistration>
  meta: Record<string, PicodashValue>
  order: Record<string, string[]>
  panelId: string
  repairProposal: PicodashRepairProposal | null
  values: Record<string, PicodashValue>
  abortRepairProposal: () => void
  acceptRepairProposal: () => PicodashWriteResult
  registerItem: (item: PicodashItemRegistration) => void
  moveItemToIndex: (itemId: string, index: number) => void
  moveItemRelativeTo: (itemId: string, overId: string, position: 'before' | 'after') => void
  reorderItem: (activeId: string, overId: string) => void
  resetFieldValue: (fieldId: string) => PicodashWriteResult
  resetFields: () => PicodashWriteResult
  resetRegisteredFields: () => PicodashWriteResult
  applyRegisteredFieldOutputs: (
    outputs: Record<string, PicodashFieldOutput>,
    options?: { preserveMeta?: boolean; resetFields?: readonly string[] },
  ) => void
  replaceRegisteredFieldValues: (values: Record<string, PicodashValue>) => PicodashWriteResult
  setFieldDefault: (fieldId: string, value: PicodashValue | undefined) => void
  setFieldInput: (fieldId: string, value: unknown) => PicodashWriteResult
  setFieldValue: (fieldId: string, value: unknown) => PicodashWriteResult
  setFieldValues: (values: Record<string, unknown>) => PicodashWriteResult
  setFocusedItem: (itemId: string | null) => void
  setGroupCollapsed: (groupId: string, collapsed: boolean) => void
  setAllCollapsibleGroupsCollapsed: (collapsed: boolean) => void
  setHoveredItem: (itemId: string | null) => void
  setInteractionActive: (interactionId: string, active: boolean) => void
  setDraggingItem: (itemId: string | null) => void
  setMetaValue: (key: string, value: PicodashValue) => void
  setOrder: (parentId: string, itemIds: string[]) => void
  unregisterItem: (itemId: string) => void
}

export type PicodashPanelStore = StoreApi<PicodashPanelState>

export type PicodashPanelCorner = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'

export type PicodashPanelSnapPosition =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left'

export type PicodashPanelFixedPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'left'
  | 'right'

export type PicodashPanelPlacement =
  | { mode: 'floating'; position?: PicodashPanelCorner }
  | { mode: 'magnetic'; position: PicodashPanelSnapPosition }
  | { mode: 'fixed'; position: PicodashPanelFixedPosition }

/**
 * The four original corner strings remain accepted as shorthand for floating placement.
 */
export type PicodashPanelDefaultPlacement = PicodashPanelCorner | PicodashPanelPlacement

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
  children?: ReactNode
  boundary?: PicodashPanelBoundary | null
  close?: boolean | PicodashPanelCloseOptions
  collapsible?: boolean
  defaultCollapsed?: boolean
  defaultPlacement?: PicodashPanelDefaultPlacement
  defaultVisible?: boolean
  onClose?: (details: PicodashPanelCloseDetails) => void
  theme?: string
  title?: ReactNode
  width?: number | string
}

export type PicodashPanelProps =
  | (PicodashPanelBaseProps & {
      id: string
      initialMeta?: Record<string, PicodashValue>
      initialValues?: Record<string, PicodashValue>
      store?: never
    })
  | (PicodashPanelBaseProps & {
      id?: never
      initialMeta?: never
      initialValues?: never
      store: PicodashPanelStore
    })

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
