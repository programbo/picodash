import type { ReactNode } from "react";
import type { StoreApi } from "zustand/vanilla";

export type PrimitiveValue = number | string | boolean;
export type ControlKind = "number" | "slider" | "select" | "checkbox";
export type StaleMode = "ignore" | "prune";
export type Placement = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface NumberControl {
  type?: "number";
  value: number;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
}

export interface SliderControl {
  type: "slider";
  value: number;
  min: number;
  max: number;
  step?: number;
  label?: string;
}

export interface SelectControl<T extends string = string> {
  type: "select";
  value: T;
  options: readonly T[] | Record<string, T>;
  label?: string;
}

export interface CheckboxControl {
  type?: "checkbox";
  value: boolean;
  label?: string;
}

export type ControlConfig =
  | number
  | boolean
  | string
  | NumberControl
  | SliderControl
  | SelectControl
  | CheckboxControl;

export type TweakerSchema = Record<string, ControlConfig>;

export type InferControlValue<T> = T extends number
  ? number
  : T extends boolean
    ? boolean
    : T extends string
      ? string
      : T extends { value: infer V }
        ? V extends PrimitiveValue
          ? V
          : never
        : never;

export type TweakerValues<T extends TweakerSchema> = {
  [K in keyof T]: InferControlValue<T[K]>;
};

export type SetTweakerValue<T extends TweakerSchema> = <K extends keyof T>(
  key: K,
  value: InferControlValue<T[K]>,
) => void;

export interface NormalizedControl {
  id: string;
  key: string;
  section: string;
  sortable: boolean;
  kind: ControlKind;
  label: string;
  value: PrimitiveValue;
  defaultValue: PrimitiveValue;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ label: string; value: string }>;
}

export type DockEdge = "top" | "right" | "bottom" | "left";

export interface DockState {
  edge: DockEdge;
  secondaryEdge?: DockEdge;
  offset: number;
}

export interface PersistedState {
  values: Record<string, PrimitiveValue>;
  order: Record<string, string[]>;
  collapsed: boolean;
  dock: DockState | null;
}

export interface TweakerSnapshot extends PersistedState {
  controls: NormalizedControl[];
  sectionOrder: string[];
}

export interface RegisterOptions {
  section?: string;
  sortable?: boolean;
}

export interface TweakerStoreOptions {
  storeId: string;
  stale: StaleMode;
}

export interface TweakerState extends TweakerSnapshot {
  register: (schema: TweakerSchema, options?: RegisterOptions) => () => void;
  setValue: (id: string, value: PrimitiveValue) => void;
  setCollapsed: (collapsed: boolean) => void;
  setDock: (dock: DockState | null) => void;
  setSectionOrder: (section: string, ids: string[]) => void;
  resetValues: () => void;
  resetOrder: () => void;
  getControlId: (section: string, key: string) => string;
}

export type TweakerStore = StoreApi<TweakerState>;

export interface TweakerProviderProps {
  children: ReactNode;
  storeId: string;
  stale?: StaleMode;
}
