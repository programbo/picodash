import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

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

interface PersistedState {
  values?: Record<string, PrimitiveValue>;
  order?: Record<string, string[]>;
  collapsed?: boolean;
  dock?: DockState;
}

export interface DockState {
  edge: "top" | "right" | "bottom" | "left";
  offset: number;
}

interface Snapshot {
  controls: NormalizedControl[];
  sectionOrder: string[];
  values: Record<string, PrimitiveValue>;
  order: Record<string, string[]>;
  collapsed: boolean;
  dock: DockState | null;
}

interface RegisterOptions {
  section?: string;
  sortable?: boolean;
}

interface TweakerStoreOptions {
  storeId: string;
  stale: StaleMode;
}

const defaultSection = "Controls";
const storagePrefix = "tweaker:";

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

function readPersisted(storeId: string): PersistedState {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(`${storagePrefix}${storeId}`);
    return raw ? (JSON.parse(raw) as PersistedState) : {};
  } catch {
    return {};
  }
}

function writePersisted(storeId: string, state: PersistedState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${storagePrefix}${storeId}`, JSON.stringify(state));
}

export class TweakerStore {
  private readonly storeId: string;
  private readonly stale: StaleMode;
  private readonly listeners = new Set<() => void>();
  private registrations = new Map<string, NormalizedControl>();
  private persisted: PersistedState;
  private snapshot: Snapshot;

  constructor({ storeId, stale }: TweakerStoreOptions) {
    this.storeId = storeId;
    this.stale = stale;
    this.persisted = readPersisted(storeId);
    this.snapshot = this.createSnapshot();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  register(schema: TweakerSchema, options: RegisterOptions = {}) {
    const section = options.section ?? defaultSection;
    const sortable = options.sortable ?? true;
    const controls = Object.entries(schema).map(([key, config]) =>
      normalizeControl(this.storeId, section, key, config, sortable),
    );
    const ids = new Set(controls.map((control) => control.id));

    for (const control of controls) {
      this.registrations.set(control.id, control);
    }

    this.rebuild();

    return () => {
      for (const id of ids) {
        this.registrations.delete(id);
      }
      this.rebuild();
    };
  }

  setValue(id: string, value: PrimitiveValue) {
    const control = this.registrations.get(id);
    if (!control) return;

    const nextValue = typeof value === "number" ? clamp(value, control.min, control.max) : value;
    this.persisted = {
      ...this.persisted,
      values: { ...this.persisted.values, [id]: nextValue },
    };
    this.persist();
    this.rebuild();
  }

  setCollapsed(collapsed: boolean) {
    this.persisted = { ...this.persisted, collapsed };
    this.persist();
    this.rebuild();
  }

  setDock(dock: DockState | null) {
    this.persisted = { ...this.persisted, dock: dock ?? undefined };
    this.persist();
    this.rebuild();
  }

  setSectionOrder(section: string, ids: string[]) {
    this.persisted = {
      ...this.persisted,
      order: { ...this.persisted.order, [section]: ids },
    };
    this.persist();
    this.rebuild();
  }

  resetValues() {
    this.persisted = { ...this.persisted, values: {} };
    this.persist();
    this.rebuild();
  }

  resetOrder() {
    this.persisted = { ...this.persisted, order: {} };
    this.persist();
    this.rebuild();
  }

  getControlId(section: string, key: string) {
    return `${this.storeId}:${section}:${String(key)}`;
  }

  private persist() {
    writePersisted(this.storeId, this.persisted);
  }

  private rebuild() {
    if (this.stale === "prune") {
      const currentIds = new Set(this.registrations.keys());
      const values = Object.fromEntries(
        Object.entries(this.persisted.values ?? {}).filter(([id]) => currentIds.has(id)),
      );
      const order = Object.fromEntries(
        Object.entries(this.persisted.order ?? {}).map(([section, ids]) => [
          section,
          ids.filter((id) => currentIds.has(id)),
        ]),
      );
      this.persisted = { ...this.persisted, values, order };
      this.persist();
    }

    this.snapshot = this.createSnapshot();
    for (const listener of this.listeners) listener();
  }

  private createSnapshot(): Snapshot {
    const values = this.persisted.values ?? {};
    const controls = Array.from(this.registrations.values()).map((control) => ({
      ...control,
      value: values[control.id] ?? control.defaultValue,
    }));
    const sectionOrder = Array.from(new Set(controls.map((control) => control.section)));

    return {
      controls,
      sectionOrder,
      values,
      order: this.persisted.order ?? {},
      collapsed: this.persisted.collapsed ?? false,
      dock: this.persisted.dock ?? null,
    };
  }
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
    storeRef.current = new TweakerStore({ storeId, stale });
  }

  return <TweakerContext.Provider value={storeRef.current}>{children}</TweakerContext.Provider>;
}

export function useTweakerStore() {
  const store = useContext(TweakerContext);
  if (!store) {
    throw new Error("Tweaker components must be rendered inside TweakerProvider.");
  }
  return store;
}

export function useTweakerSnapshot() {
  const store = useTweakerStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

export function useTweaker<T extends TweakerSchema>(
  schema: T,
  options: RegisterOptions = {},
): [TweakerValues<T>, SetTweakerValue<T>] {
  const store = useTweakerStore();
  const section = options.section ?? defaultSection;
  const sortable = options.sortable ?? true;
  const schemaRef = useRef(schema);
  schemaRef.current = schema;

  useEffect(
    () => store.register(schema, { section, sortable }),
    [store, schema, section, sortable],
  );

  const snapshot = useTweakerSnapshot();

  const values = useMemo(() => {
    const output: Partial<TweakerValues<T>> = {};
    for (const key of Object.keys(schemaRef.current) as Array<keyof T>) {
      const id = store.getControlId(section, String(key));
      const control = snapshot.controls.find((item) => item.id === id);
      output[key] = control?.value as TweakerValues<T>[keyof T];
    }
    return output as TweakerValues<T>;
  }, [schemaRef, section, snapshot.controls, store]);

  const setValue = useCallback<SetTweakerValue<T>>(
    (key, value) => {
      store.setValue(store.getControlId(section, String(key)), value);
    },
    [section, store],
  );

  return [values, setValue];
}
