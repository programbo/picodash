import type { ComponentType, ReactNode } from 'react'
import type { StoreApi } from 'zustand'

export const defaultPanelId = 'default'
export const defaultSectionId = 'controls'
export const defaultSectionLabel = 'Controls'

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export type PrimitiveValue = number | string | boolean
export type ControlKind = 'number' | 'slider' | 'select' | 'checkbox' | 'display' | 'custom'
export type BuiltInControlKind = Exclude<ControlKind, 'custom'>
export type ControlStatus = 'info' | 'alert' | 'error'
export type StaleMode = 'ignore' | 'prune'
export type Placement = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
export type DockEdge = 'top' | 'right' | 'bottom' | 'left'
export type PanelTheme = 'dark' | 'light' | 'system'

interface ControlIdentity {
  id?: string
  label?: string
  help?: string
  /** Footer content rendered below the control. Re-register to update dynamic content. */
  description?: ReactNode
  /** Renders the control faded/greyscale and blocks value writes. */
  readOnly?: boolean
  /** Hides the control row while preserving its value and order slot. */
  hidden?: boolean
}

interface ControlStatusMetadata {
  status?: ControlStatus
}

interface ValueControl<T extends JsonValue> extends ControlIdentity, ControlStatusMetadata {
  defaultValue?: T
  value?: T
}

export interface NumberControl extends ValueControl<number> {
  type?: 'number'
  min?: number
  max?: number
  step?: number
  /** Intl.NumberFormatOptions applied to the number field's display/parsing. */
  formatOptions?: Intl.NumberFormatOptions
}

export interface SliderControl extends ValueControl<number> {
  type: 'slider'
  min: number
  max: number
  step?: number
  /** Intl.NumberFormatOptions applied to the slider output. */
  formatOptions?: Intl.NumberFormatOptions
}

export interface SelectControl<T extends string = string> extends ValueControl<T> {
  type: 'select'
  options: readonly T[] | Record<string, T>
}

export interface CheckboxControl extends ValueControl<boolean> {
  type?: 'checkbox'
}

export interface DisplayControl extends ValueControl<string | number> {
  type: 'display'
  /** Intl.NumberFormatOptions applied when the value is a number. */
  formatOptions?: Intl.NumberFormatOptions
  /** Template string; `{value}` is replaced with the (formatted) value. */
  format?: string
}

export interface CustomControl<T extends JsonValue = JsonValue> extends ValueControl<T> {
  type: string
  [key: string]: unknown
}

export type ControlConfig =
  | number
  | boolean
  | string
  | NumberControl
  | SliderControl
  | SelectControl
  | CheckboxControl
  | DisplayControl
  | CustomControl

export type TweakerSchema = Record<string, ControlConfig>

export type InferControlValue<T> = T extends number
  ? number
  : T extends boolean
    ? boolean
    : T extends string
      ? string
      : T extends { defaultValue: infer V }
        ? V extends JsonValue
          ? V
          : never
        : T extends { value: infer V }
          ? V extends JsonValue
            ? V
            : never
          : never

export type TweakerValues<T extends TweakerSchema> = {
  [K in keyof T]: InferControlValue<T[K]>
}

export type SetTweakerValue<T extends TweakerSchema> = <K extends keyof T>(
  key: K,
  value: InferControlValue<T[K]>,
) => void

export interface SectionConfig {
  id: string
  label: string
  /** Hides the section while preserving its controls' values and order. */
  hidden?: boolean
}

export interface PanelAppearance {
  surfaceOpacity?: number
  activeSurfaceOpacity?: number
  backdropBlur?: number
  activeBackdropBlur?: number
}

export interface NormalizedControl {
  id: string
  persistId: string
  domId: string
  key: string
  controlId: string
  panelId: string
  sectionId: string
  sectionLabel: string
  section: string
  reorderable: boolean
  sortable: boolean
  status?: ControlStatus
  help?: string
  description?: ReactNode
  readOnly?: boolean
  hidden?: boolean
  kind: ControlKind
  type: string
  label: string
  value: JsonValue
  defaultValue: JsonValue
  min?: number
  max?: number
  step?: number
  formatOptions?: Intl.NumberFormatOptions
  /** Template string for display controls; `{value}` is replaced post-format. */
  format?: string
  options?: Array<{ label: string; value: string }>
  settings?: Record<string, unknown>
}

export interface DockState {
  edge: DockEdge
  secondaryEdge?: DockEdge
  offset: number
}

export interface PanelLayoutState {
  collapsed: boolean
  dock: DockState | null
}

export interface PersistedState {
  values: Record<string, JsonValue>
  order: Record<string, Record<string, string[]>>
  panels: Record<string, PanelLayoutState>
  sections: Record<string, Record<string, boolean>>
}

export interface TweakerSnapshot extends PersistedState {
  storeId: string
  controls: NormalizedControl[]
  sectionOrder: Record<string, string[]>
  panelAppearances: Record<string, PanelAppearance>
  hiddenSections: Record<string, Record<string, boolean>>
}

export interface RegisterOptions {
  panel?: string
  section?: string | SectionConfig
  reorderable?: boolean
  sortable?: boolean
  opacity?: number
  hoverOpacity?: number
  backgroundBlur?: number
  hoverBackgroundBlur?: number
}

export interface TweakerPersistenceOptions {
  key?: string
}

export interface TweakerStoreOptions {
  id?: string
  storeId?: string
  persistence?: false | TweakerPersistenceOptions
  stale?: StaleMode
}

export interface TweakerState extends TweakerSnapshot {
  register: (schema: TweakerSchema, options?: RegisterOptions) => () => void
  updatePanelEffects: (schema: TweakerSchema, options?: RegisterOptions) => void
  setValue: (persistId: string, value: JsonValue) => void
  setPanelCollapsed: (panelId: string, collapsed: boolean) => void
  setSectionCollapsed: (panelId: string, sectionId: string, collapsed: boolean) => void
  setAllSectionsCollapsed: (panelId: string, collapsed: boolean) => void
  setPanelDock: (panelId: string, dock: DockState | null) => void
  setSectionOrder: (panelId: string, sectionId: string, ids: string[]) => void
  resetValues: (panelId?: string) => void
  resetOrder: (panelId?: string) => void
  getControlId: (
    panelId: string,
    sectionId: string,
    key: string,
    explicitControlId?: string,
  ) => string
  getPanelState: (panelId: string) => PanelLayoutState
}

export type TweakerStore = StoreApi<TweakerState>

export interface TweakerCustomControlProps<T extends JsonValue = JsonValue> {
  id: string
  label: string
  value: T
  defaultValue: T
  setValue: (value: T) => void
  control: NormalizedControl
  disabled?: boolean
  readOnly?: boolean
}

export type TweakerCustomControlComponent<T extends JsonValue = JsonValue> = ComponentType<
  TweakerCustomControlProps<T>
>

export interface TweakerProviderProps {
  children: ReactNode
  id?: string
  storeId?: string
  persistence?: false | TweakerPersistenceOptions
  stale?: StaleMode
  controls?: Record<string, TweakerCustomControlComponent>
}
