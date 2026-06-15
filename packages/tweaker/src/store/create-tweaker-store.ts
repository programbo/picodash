import { createStore } from "zustand/vanilla";
import { persist } from "zustand/middleware";
import {
  clamp,
  createControlId,
  defaultSection,
  normalizeControl,
  normalizePanelEffects,
  sectionOrderFor,
  statusForControl,
  valuesForControls,
} from "../control.js";
import type {
  NormalizedControl,
  PersistedState,
  StaleMode,
  TweakerState,
  TweakerStore,
  TweakerStoreOptions,
} from "../types.js";
import {
  createValidatedPersistStorage,
  emptyPersistedState,
  persistedStateSchema,
  storagePrefix,
} from "./persistence.js";

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

function controlsEqual(left: NormalizedControl[], right: NormalizedControl[]) {
  if (left.length !== right.length) return false;

  return left.every((leftControl, index) => {
    const rightControl = right[index];
    if (!rightControl) return false;

    return (
      leftControl.id === rightControl.id &&
      leftControl.key === rightControl.key &&
      leftControl.section === rightControl.section &&
      leftControl.sortable === rightControl.sortable &&
      leftControl.opacity === rightControl.opacity &&
      leftControl.hoverOpacity === rightControl.hoverOpacity &&
      leftControl.backgroundBlur === rightControl.backgroundBlur &&
      leftControl.hoverBackgroundBlur === rightControl.hoverBackgroundBlur &&
      leftControl.status === rightControl.status &&
      leftControl.kind === rightControl.kind &&
      leftControl.label === rightControl.label &&
      leftControl.value === rightControl.value &&
      leftControl.defaultValue === rightControl.defaultValue &&
      leftControl.min === rightControl.min &&
      leftControl.max === rightControl.max &&
      leftControl.step === rightControl.step &&
      optionsEqual(leftControl.options, rightControl.options)
    );
  });
}

function optionsEqual(left: NormalizedControl["options"], right: NormalizedControl["options"]) {
  if (left === right) return true;
  if (!left || !right || left.length !== right.length) return false;

  return left.every((leftOption, index) => {
    const rightOption = right[index];
    return rightOption?.label === leftOption.label && rightOption.value === leftOption.value;
  });
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
            normalizeControl(
              storeId,
              section,
              key,
              config,
              sortable,
              options.opacity,
              options.hoverOpacity,
              options.backgroundBlur,
              options.hoverBackgroundBlur,
            ),
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
            if (controlsEqual(state.controls, nextControls)) return state;

            return {
              controls: nextControls,
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

        updatePanelEffects(schema, options = {}) {
          const section = options.section ?? defaultSection;
          const ids = new Set(
            Object.keys(schema).map((key) => createControlId(storeId, section, key)),
          );
          const effects = normalizePanelEffects(options);

          set((state) => {
            let changed = false;
            const controls = state.controls.map((control) => {
              if (!ids.has(control.id)) return control;
              if (
                control.opacity === effects.opacity &&
                control.hoverOpacity === effects.hoverOpacity &&
                control.backgroundBlur === effects.backgroundBlur &&
                control.hoverBackgroundBlur === effects.hoverBackgroundBlur
              ) {
                return control;
              }

              changed = true;
              return { ...control, ...effects };
            });

            if (!changed) return state;
            return { controls };
          });
        },

        updateControlStatuses(schema, options = {}) {
          const section = options.section ?? defaultSection;
          const statuses = new Map(
            Object.entries(schema).map(([key, config]) => [
              createControlId(storeId, section, key),
              statusForControl(config),
            ]),
          );

          set((state) => {
            let changed = false;
            const controls = state.controls.map((control) => {
              if (!statuses.has(control.id)) return control;
              const status = statuses.get(control.id);
              if (control.status === status) return control;

              changed = true;
              return { ...control, status };
            });

            if (!changed) return state;
            return { controls };
          });
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
