import type { HTMLMotionProps } from 'motion/react'
import type { ReactNode, RefObject } from 'react'
import type { StoreApi } from 'zustand'

export type TweakerValue =
  | string
  | number
  | boolean
  | null
  | TweakerValue[]
  | { [key: string]: TweakerValue }

export type TweakerPlacement = 'auto' | 'start' | 'end'
export type TweakerItemKind = 'control' | 'group'
export type TweakerStatus = 'info' | 'warning' | 'alert' | 'error'
export type TweakerControlStateValue = boolean | string | number | null | undefined
export type TweakerControlStates = Record<string, TweakerControlStateValue>

export const tweakerItemImportAllowedStringValues = Symbol('tweakerItemImportAllowedStringValues')

export interface TweakerFieldState {
  defaultValue?: TweakerValue
  dirty: boolean
  errors: string[]
  touched: boolean
}

export interface TweakerItemRegistration {
  [tweakerItemImportAllowedStringValues]?: readonly string[]
  collapsible?: boolean
  defaultCollapsed?: boolean
  defaultValue?: TweakerValue
  displayOnly?: boolean
  fieldId?: string
  hidden?: boolean
  id: string
  kind: TweakerItemKind
  label?: string
  parentId: string
  placement: TweakerPlacement
  reorderable: boolean
}

export interface TweakerInteractionState {
  activeIds: Record<string, true>
  draggingId: string | null
  focusedId: string | null
  hoveredId: string | null
}

export interface TweakerPanelState {
  collapsedGroups: Record<string, boolean>
  fields: Record<string, TweakerFieldState>
  interaction: TweakerInteractionState
  items: Record<string, TweakerItemRegistration>
  meta: Record<string, TweakerValue>
  order: Record<string, string[]>
  panelId: string
  values: Record<string, TweakerValue>
  registerItem: (item: TweakerItemRegistration) => void
  moveItemToIndex: (itemId: string, index: number) => void
  moveItemRelativeTo: (itemId: string, overId: string, position: 'before' | 'after') => void
  reorderItem: (activeId: string, overId: string) => void
  resetFieldValue: (fieldId: string) => void
  resetFields: () => void
  resetRegisteredFields: () => void
  replaceRegisteredFieldValues: (values: Record<string, TweakerValue>) => void
  setFieldDefault: (fieldId: string, value: TweakerValue | undefined) => void
  setFieldValue: (fieldId: string, value: TweakerValue) => void
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

export interface TweakerPanelProps extends Omit<
  HTMLMotionProps<'aside'>,
  'children' | 'dragConstraints' | 'id' | 'title'
> {
  children?: ReactNode
  collapsible?: boolean
  defaultCollapsed?: boolean
  defaultValues?: Record<string, TweakerValue>
  id?: string
  initialMeta?: Record<string, TweakerValue>
  title?: ReactNode
}

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
