import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import { persist, type PersistStorage } from "zustand/middleware";
import { z } from "zod";

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

export interface DockState {
  edge: "top" | "right" | "bottom" | "left";
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

const defaultSection = "Controls";
const storagePrefix = "tweaker:";

const primitiveValueSchema = z.union([z.number(), z.string(), z.boolean()]);
const dockStateSchema = z.object({
  edge: z.enum(["top", "right", "bottom", "left"]),
  offset: z.number().finite().nonnegative(),
});
const persistedStateSchema = z.object({
  values: z.record(z.string(), primitiveValueSchema).default({}),
  order: z.record(z.string(), z.array(z.string())).default({}),
  collapsed: z.boolean().default(false),
  dock: dockStateSchema.nullable().default(null),
});
const persistedStorageValueSchema = z.object({
  state: persistedStateSchema,
  version: z.number().optional(),
});

function emptyPersistedState(): PersistedState {
  return { values: {}, order: {}, collapsed: false, dock: null };
}

function labelFromKey(key: string) {
  return key
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (char) => char.toUpperCase());
}

function clamp(value: number, min?: number, max?: number) {
  let next = value;
  if (typeof min === "number") next = Math.max(min, next);
  if (typeof max === "number") next = Math.min(max, next);
  return next;
}

function normalizeOptions(options: readonly string[] | Record<string, string>) {
  if (Array.isArray(options)) {
    return options.map((value) => ({ label: labelFromKey(value), value }));
  }

  return Object.entries(options).map(([label, value]) => ({ label, value }));
}

export function normalizeControl(
  storeId: string,
  section: string,
  key: string,
  config: ControlConfig,
  sortable = true,
): NormalizedControl {
  const id = `${storeId}:${section}:${key}`;
  const fallbackLabel = labelFromKey(key);

  if (typeof config === "number") {
    return {
      id,
      key,
      section,
      sortable,
      kind: "number",
      label: fallbackLabel,
      value: config,
      defaultValue: config,
    };
  }

  if (typeof config === "boolean") {
    return {
      id,
      key,
      section,
      sortable,
      kind: "checkbox",
      label: fallbackLabel,
      value: config,
      defaultValue: config,
    };
  }

  if (typeof config === "string") {
    return {
      id,
      key,
      section,
      sortable,
      kind: "select",
      label: fallbackLabel,
      value: config,
      defaultValue: config,
      options: [{ label: labelFromKey(config), value: config }],
    };
  }

  if ("options" in config) {
    return {
      id,
      key,
      section,
      sortable,
      kind: "select",
      label: config.label ?? fallbackLabel,
      value: config.value,
      defaultValue: config.value,
      options: normalizeOptions(config.options),
    };
  }

  if (typeof config.value === "boolean") {
    return {
      id,
      key,
      section,
      sortable,
      kind: "checkbox",
      label: config.label ?? fallbackLabel,
      value: config.value,
      defaultValue: config.value,
    };
  }

  const hasSliderBounds =
    config.type === "slider" ||
    (config.type !== "number" && typeof config.min === "number" && typeof config.max === "number");
  const kind: ControlKind = hasSliderBounds ? "slider" : "number";

  return {
    id,
    key,
    section,
    sortable,
    kind,
    label: config.label ?? fallbackLabel,
    value: config.value,
    defaultValue: config.value,
    min: config.min,
    max: config.max,
    step: config.step,
  };
}

function createValidatedPersistStorage(): PersistStorage<PersistedState> {
  return {
    getItem(name) {
      if (typeof window === "undefined") return null;

      try {
        const raw = window.localStorage.getItem(name);
        if (!raw) return null;

        const parsed = persistedStorageValueSchema.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },
    setItem(name, value) {
      if (typeof window === "undefined") return;

      const parsed = persistedStorageValueSchema.safeParse(value);
      if (!parsed.success) return;

      window.localStorage.setItem(name, JSON.stringify(parsed.data));
    },
    removeItem(name) {
      if (typeof window === "undefined") return;
      window.localStorage.removeItem(name);
    },
  };
}

function valuesForControls(
  controls: NormalizedControl[],
  values: Record<string, PrimitiveValue>,
): NormalizedControl[] {
  return controls.map((control) => ({
    ...control,
    value: values[control.id] ?? control.defaultValue,
  }));
}

function sectionOrderFor(controls: NormalizedControl[]) {
  return Array.from(new Set(controls.map((control) => control.section)));
}

function prunePersisted(
  persisted: PersistedState,
  controls: NormalizedControl[],
  stale: StaleMode,
): PersistedState {
  if (stale !== "prune") return persisted;

  const currentIds = new Set(controls.map((control) => control.id));
  const values = Object.fromEntries(
    Object.entries(persisted.values).filter(([id]) => currentIds.has(id)),
  );
  const order = Object.fromEntries(
    Object.entries(persisted.order).map(([section, ids]) => [
      section,
      ids.filter((id) => currentIds.has(id)),
    ]),
  );

  return { ...persisted, values, order };
}

function createControlId(storeId: string, section: string, key: string) {
  return `${storeId}:${section}:${String(key)}`;
}

export function createTweakerStore({ storeId, stale }: TweakerStoreOptions): TweakerStore {
  return createStore<TweakerState>()(
    persist(
      (set, get) => ({
        ...emptyPersistedState(),
        controls: [],
        sectionOrder: [],

        register(schema, options = {}) {
          const section = options.section ?? defaultSection;
          const sortable = options.sortable ?? true;
          const controls = Object.entries(schema).map(([key, config]) =>
            normalizeControl(storeId, section, key, config, sortable),
          );
          const ids = new Set(controls.map((control) => control.id));

          set((state) => {
            const controlsById = new Map(state.controls.map((control) => [control.id, control]));
            for (const control of controls) {
              controlsById.set(control.id, {
                ...control,
                value: state.values[control.id] ?? control.defaultValue,
              });
            }
            const nextControls = valuesForControls(Array.from(controlsById.values()), state.values);
            const persisted = prunePersisted(
              {
                values: state.values,
                order: state.order,
                collapsed: state.collapsed,
                dock: state.dock,
              },
              nextControls,
              stale,
            );

            return {
              ...persisted,
              controls: valuesForControls(nextControls, persisted.values),
              sectionOrder: sectionOrderFor(nextControls),
            };
          });

          return () => {
            set((state) => {
              const nextControls = state.controls.filter((control) => !ids.has(control.id));
              const persisted = prunePersisted(
                {
                  values: state.values,
                  order: state.order,
                  collapsed: state.collapsed,
                  dock: state.dock,
                },
                nextControls,
                stale,
              );

              return {
                ...persisted,
                controls: valuesForControls(nextControls, persisted.values),
                sectionOrder: sectionOrderFor(nextControls),
              };
            });
          };
        },

        setValue(id, value) {
          const control = get().controls.find((item) => item.id === id);
          if (!control) return;

          const nextValue =
            typeof value === "number" ? clamp(value, control.min, control.max) : value;

          set((state) => {
            const values = { ...state.values, [id]: nextValue };
            return {
              values,
              controls: valuesForControls(state.controls, values),
            };
          });
        },

        setCollapsed(collapsed) {
          set({ collapsed });
        },

        setDock(dock) {
          set({ dock });
        },

        setSectionOrder(section, ids) {
          set((state) => ({
            order: { ...state.order, [section]: ids },
          }));
        },

        resetValues() {
          set((state) => ({
            values: {},
            controls: valuesForControls(state.controls, {}),
          }));
        },

        resetOrder() {
          set({ order: {} });
        },

        getControlId(section, key) {
          return createControlId(storeId, section, key);
        },
      }),
      {
        name: `${storagePrefix}${storeId}`,
        storage: createValidatedPersistStorage(),
        partialize: (state) => ({
          values: state.values,
          order: state.order,
          collapsed: state.collapsed,
          dock: state.dock,
        }),
        merge: (persistedState, currentState) => {
          const parsed = persistedStateSchema.safeParse(persistedState);
          if (!parsed.success) return currentState;

          return {
            ...currentState,
            ...parsed.data,
            controls: valuesForControls(currentState.controls, parsed.data.values),
          };
        },
      },
    ),
  );
}

const TweakerContext = createContext<TweakerStore | null>(null);

export interface TweakerProviderProps {
  children: ReactNode;
  storeId: string;
  stale?: StaleMode;
}

export function TweakerProvider({ children, storeId, stale = "ignore" }: TweakerProviderProps) {
  const storeRef = useRef<TweakerStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createTweakerStore({ storeId, stale });
  }

  return <TweakerContext.Provider value={storeRef.current}>{children}</TweakerContext.Provider>;
}

function useTweakerStoreApi() {
  const store = useContext(TweakerContext);
  if (!store) {
    throw new Error("Tweaker components must be rendered inside TweakerProvider.");
  }
  return store;
}

export function useTweakerStore() {
  return useStore(useTweakerStoreApi());
}

export function useTweakerSnapshot() {
  return useStore(useTweakerStoreApi()) as TweakerSnapshot;
}

export function useTweaker<T extends TweakerSchema>(
  schema: T,
  options: RegisterOptions = {},
): [TweakerValues<T>, SetTweakerValue<T>] {
  const store = useTweakerStoreApi();
  const section = options.section ?? defaultSection;
  const sortable = options.sortable ?? true;
  const state = useStore(store);
  useEffect(
    () => store.getState().register(schema, { section, sortable }),
    [store, schema, section, sortable],
  );

  const values = useMemo(() => {
    const output: Partial<TweakerValues<T>> = {};
    for (const key of Object.keys(schema) as Array<keyof T>) {
      const id = store.getState().getControlId(section, String(key));
      const control = state.controls.find((item) => item.id === id);
      output[key] = control?.value as TweakerValues<T>[keyof T];
    }
    return output as TweakerValues<T>;
  }, [schema, section, state.controls, store]);

  const setValue = useCallback<SetTweakerValue<T>>(
    (key, value) => {
      store.getState().setValue(store.getState().getControlId(section, String(key)), value);
    },
    [section, store],
  );

  return [values, setValue];
}
