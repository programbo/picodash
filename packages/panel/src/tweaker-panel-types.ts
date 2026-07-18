import type { HTMLMotionProps } from 'motion/react'
import type { ReactNode, RefObject } from 'react'
import type { StoreApi } from 'zustand'
import type {
  TweakerConstraintRepair,
  TweakerFieldOutput,
  TweakerParser,
  TweakerValidator,
  TweakerWriteResult,
} from './tweaker-validation.js'

export type TweakerValue =
  | string
  | number
  | boolean
  | null
  | TweakerValue[]
  | { [key: string]: TweakerValue }

export type TweakerPin = 'start' | 'end'
export type TweakerItemKind = 'control' | 'group'
export type TweakerStatus = 'info' | 'warning' | 'alert' | 'error'
export type TweakerControlStateValue = boolean | string | number | null | undefined
export type TweakerControlStates = Record<string, TweakerControlStateValue>

export interface TweakerFieldState {
  defaultValue?: TweakerValue
  dirty: boolean
  draftValue?: unknown
  errors: string[]
  touched: boolean
}

export interface TweakerItemRegistration {
  collapsible?: boolean
  defaultCollapsed?: boolean
  defaultValue?: TweakerValue
  field?: string
  hidden?: boolean
  id: string
  kind: TweakerItemKind
  label?: string
  parentId: string
  parse?: TweakerParser
  pin?: TweakerPin
  reorderable: boolean
  validate?: TweakerValidator
  valueMode?: 'display' | 'input'
}

export interface TweakerInteractionState {
  activeIds: Record<string, true>
  draggingId: string | null
  focusedId: string | null
  hoveredId: string | null
}

export interface TweakerRepairProposal {
  changes: readonly TweakerConstraintRepair[]
  source: 'constraint' | 'default' | 'initial'
  token: number
}

export interface TweakerPanelState {
  collapsedGroups: Record<string, boolean>
  fields: Record<string, TweakerFieldState>
  interaction: TweakerInteractionState
  items: Record<string, TweakerItemRegistration>
  meta: Record<string, TweakerValue>
  order: Record<string, string[]>
  panelId: string
  repairProposal: TweakerRepairProposal | null
  values: Record<string, TweakerValue>
  abortRepairProposal: () => void
  acceptRepairProposal: () => TweakerWriteResult
  registerItem: (item: TweakerItemRegistration) => void
  moveItemToIndex: (itemId: string, index: number) => void
  moveItemRelativeTo: (itemId: string, overId: string, position: 'before' | 'after') => void
  reorderItem: (activeId: string, overId: string) => void
  resetFieldValue: (fieldId: string) => TweakerWriteResult
  resetFields: () => TweakerWriteResult
  resetRegisteredFields: () => TweakerWriteResult
  applyRegisteredFieldOutputs: (
    outputs: Record<string, TweakerFieldOutput>,
    options?: { preserveMeta?: boolean; resetFields?: readonly string[] },
  ) => void
  replaceRegisteredFieldValues: (values: Record<string, TweakerValue>) => void
  setFieldDefault: (fieldId: string, value: TweakerValue | undefined) => void
  setFieldInput: (fieldId: string, value: unknown) => TweakerWriteResult
  setFieldValue: (fieldId: string, value: unknown) => TweakerWriteResult
  setFieldValues: (values: Record<string, unknown>) => TweakerWriteResult
  setFocusedItem: (itemId: string | null) => void
  setGroupCollapsed: (groupId: string, collapsed: boolean) => void
  setAllCollapsibleGroupsCollapsed: (collapsed: boolean) => void
  setHoveredItem: (itemId: string | null) => void
  setInteractionActive: (interactionId: string, active: boolean) => void
  setDraggingItem: (itemId: string | null) => void
  setMetaValue: (key: string, value: TweakerValue) => void
  setOrder: (parentId: string, itemIds: string[]) => void
  unregisterItem: (itemId: string) => void
}

export type TweakerPanelStore = StoreApi<TweakerPanelState>

export type TweakerPanelDefaultPlacement = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'

interface TweakerPanelBaseProps extends Omit<
  HTMLMotionProps<'aside'>,
  'children' | 'dragConstraints' | 'id' | 'title'
> {
  children?: ReactNode
  collapsible?: boolean
  defaultCollapsed?: boolean
  defaultPlacement?: TweakerPanelDefaultPlacement
  title?: ReactNode
  width?: number | string
}

export type TweakerPanelProps =
  | (TweakerPanelBaseProps & {
      id: string
      initialMeta?: Record<string, TweakerValue>
      initialValues?: Record<string, TweakerValue>
      store?: never
    })
  | (TweakerPanelBaseProps & {
      id?: never
      initialMeta?: never
      initialValues?: never
      store: TweakerPanelStore
    })

export interface TweakerGroupContextValue {
  beginItemReorder: (
    itemId: string,
    pointerY: number,
    pointerId: number,
    setVisualOffset: (offset: number) => void,
  ) => void
  commitPendingOrder: () => void
  dragConstraintsRef: RefObject<HTMLDivElement | null>
  listRef: RefObject<HTMLDivElement | null>
  parentId: string
  registerItemMotion: (itemId: string, motion: TweakerReorderItemMotion) => () => void
}

export interface TweakerReorderItemLayout {
  id: string
  max: number
  min: number
}

export interface TweakerReorderItemMotion {
  animateFrom: (offset: number) => void
  getOffset: () => number
}
