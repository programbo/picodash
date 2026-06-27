import { createStore } from "zustand";
import { persist } from "zustand/middleware";
import {
  clamp,
  createControlPersistId,
  hasPanelEffects,
  normalizeControlEntry,
  normalizePanelEffects,
  normalizePanelId,
  normalizeSection,
  sectionOrderByPanel,
  valuesForControls,
} from "../control.js";
import {
  defaultPanelId,
  type JsonValue,
  type NormalizedControl,
  type PanelLayoutState,
  type PersistedState,
  type TweakerState,
  type TweakerStore,
  type TweakerStoreOptions,
} from "../types.js";
import {
  createValidatedPersistStorage,
  emptyPersistedState,
  persistedStateSchema,
  storagePrefix,
} from "./persistence.js";

function controlsEqual(left: NormalizedControl[], right: NormalizedControl[]) {
  if (left.length !== right.length) return false;

  return left.every((leftControl, index) => {
    const rightControl = right[index];
    if (!rightControl) return false;

    return (
      leftControl.id === rightControl.id &&
      leftControl.persistId === rightControl.persistId &&
      leftControl.domId === rightControl.domId &&
      leftControl.key === rightControl.key &&
      leftControl.controlId === rightControl.controlId &&
      leftControl.panelId === rightControl.panelId &&
      leftControl.sectionId === rightControl.sectionId &&
      leftControl.sectionLabel === rightControl.sectionLabel &&
      leftControl.reorderable === rightControl.reorderable &&
      leftControl.status === rightControl.status &&
      leftControl.help === rightControl.help &&
      leftControl.kind === rightControl.kind &&
      leftControl.type === rightControl.type &&
      leftControl.label === rightControl.label &&
      valuesEqual(leftControl.value, rightControl.value) &&
      valuesEqual(leftControl.defaultValue, rightControl.defaultValue) &&
      leftControl.min === rightControl.min &&
      leftControl.max === rightControl.max &&
      leftControl.step === rightControl.step &&
      optionsEqual(leftControl.options, rightControl.options) &&
      settingsEqual(leftControl.settings, rightControl.settings) &&
      formatOptionsEqual(leftControl.formatOptions, rightControl.formatOptions) &&
      leftControl.readOnly === rightControl.readOnly
    );
  });
}

function valuesEqual(left: JsonValue, right: JsonValue) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function settingsEqual(left: NormalizedControl["settings"], right: NormalizedControl["settings"]) {
  return JSON.stringify(left ?? {}) === JSON.stringify(right ?? {});
}

function optionsEqual(left: NormalizedControl["options"], right: NormalizedControl["options"]) {
  if (left === right) return true;
  if (!left || !right || left.length !== right.length) return false;

  return left.every((leftOption, index) => {
    const rightOption = right[index];
    return rightOption?.label === leftOption.label && rightOption.value === leftOption.value;
  });
}

function formatOptionsEqual(
  left: NormalizedControl["formatOptions"],
  right: NormalizedControl["formatOptions"],
) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function defaultPanelState(): PanelLayoutState {
  return { collapsed: false, dock: null };
}

function panelStateFor(state: Pick<TweakerState, "panels">, panelId: string): PanelLayoutState {
  return state.panels[panelId] ?? defaultPanelState();
}

function panelOrderFor(state: Pick<TweakerState, "order">, panelId: string) {
  return state.order[panelId] ?? {};
}

function panelSectionsFor(state: Pick<TweakerState, "sections">, panelId: string) {
  return state.sections[panelId] ?? {};
}

function createBaseState(storeId: string) {
  return (
    set: (
      partial:
        | TweakerState
        | Partial<TweakerState>
        | ((state: TweakerState) => TweakerState | Partial<TweakerState>),
      replace?: false,
    ) => void,
    get: () => TweakerState,
  ): TweakerState => ({
    ...emptyPersistedState(),
    storeId,
    controls: [],
    sectionOrder: {},
    panelAppearances: {},

    register(schema, options = {}) {
      const panelId = normalizePanelId(options.panel);
      const section = normalizeSection(options.section);
      const reorderable = options.reorderable ?? options.sortable ?? true;
      const controls = Object.entries(schema).map(([key, config]) =>
        normalizeControlEntry({
          storeId,
          panelId,
          section,
          key,
          config,
          reorderable,
        }),
      );
      const ids = new Set(controls.map((control) => control.persistId));

      set((state) => {
        const controlsById = new Map(state.controls.map((control) => [control.persistId, control]));
        for (const control of controls) {
          controlsById.set(control.persistId, {
            ...control,
            value: Object.prototype.hasOwnProperty.call(state.values, control.persistId)
              ? state.values[control.persistId]!
              : control.defaultValue,
          });
        }

        const nextControls = valuesForControls(Array.from(controlsById.values()), state.values);
        if (controlsEqual(state.controls, nextControls)) return state;

        return {
          controls: nextControls,
          sectionOrder: sectionOrderByPanel(nextControls),
        };
      });

      return () => {
        set((state) => {
          const nextControls = state.controls.filter((control) => !ids.has(control.persistId));
          return {
            controls: valuesForControls(nextControls, state.values),
            sectionOrder: sectionOrderByPanel(nextControls),
          };
        });
      };
    },

    updatePanelEffects(_schema, options = {}) {
      if (!hasPanelEffects(options)) return;
      const panelId = normalizePanelId(options.panel);
      const appearance = normalizePanelEffects(options);

      set((state) => ({
        panelAppearances: {
          ...state.panelAppearances,
          [panelId]: {
            ...state.panelAppearances[panelId],
            ...appearance,
          },
        },
      }));
    },

    setValue(persistId, value) {
      const control = get().controls.find((item) => item.persistId === persistId);
      if (!control) return;
      if (control.readOnly) return;

      const nextValue = typeof value === "number" ? clamp(value, control.min, control.max) : value;

      set((state) => {
        const values = { ...state.values, [persistId]: nextValue };
        return {
          values,
          controls: valuesForControls(state.controls, values),
        };
      });
    },

    setPanelCollapsed(panelId, collapsed) {
      set((state) => ({
        panels: {
          ...state.panels,
          [panelId]: { ...panelStateFor(state, panelId), collapsed },
        },
      }));
    },

    setSectionCollapsed(panelId, sectionId, collapsed) {
      set((state) => ({
        sections: {
          ...state.sections,
          [panelId]: {
            ...panelSectionsFor(state, panelId),
            [sectionId]: collapsed,
          },
        },
      }));
    },

    setPanelDock(panelId, dock) {
      set((state) => ({
        panels: {
          ...state.panels,
          [panelId]: { ...panelStateFor(state, panelId), dock },
        },
      }));
    },

    setSectionOrder(panelId, sectionId, ids) {
      set((state) => ({
        order: {
          ...state.order,
          [panelId]: {
            ...panelOrderFor(state, panelId),
            [sectionId]: ids,
          },
        },
      }));
    },

    resetValues(panelId) {
      set((state) => {
        const values =
          panelId === undefined
            ? {}
            : Object.fromEntries(
                Object.entries(state.values).filter(([id]) => {
                  const control = state.controls.find((item) => item.persistId === id);
                  return control?.panelId !== panelId;
                }),
              );

        return {
          values,
          controls: valuesForControls(state.controls, values),
        };
      });
    },

    resetOrder(panelId) {
      if (panelId === undefined) {
        set({ order: {} });
        return;
      }

      set((state) => {
        const { [panelId]: _removed, ...order } = state.order;
        return { order };
      });
    },

    getControlId(panelId, sectionId, key, explicitControlId) {
      return createControlPersistId(
        storeId,
        normalizePanelId(panelId),
        { id: sectionId, label: sectionId },
        key,
        explicitControlId,
      );
    },

    getPanelState(panelId) {
      return panelStateFor(get(), panelId);
    },
  });
}

function createMemoryStore(storeId: string): TweakerStore {
  return createStore<TweakerState>()(createBaseState(storeId));
}

function createPersistedStore(storeId: string, storageKey: string): TweakerStore {
  return createStore<TweakerState>()(
    persist(createBaseState(storeId), {
      name: storageKey,
      storage: createValidatedPersistStorage(),
      partialize: (state): PersistedState => ({
        values: state.values,
        order: state.order,
        panels: state.panels,
        sections: state.sections,
      }),
      merge: (persistedState, currentState) => {
        const parsed = persistedStateSchema.safeParse(persistedState);
        if (!parsed.success) return currentState;
        const persisted = parsed.data as PersistedState;

        return {
          ...currentState,
          ...persisted,
          controls: valuesForControls(currentState.controls, persisted.values),
        };
      },
    }),
  );
}

export function createTweakerStore(options: TweakerStoreOptions): TweakerStore {
  const storeId = options.id ?? options.storeId ?? defaultPanelId;
  if (options.persistence === false) return createMemoryStore(storeId);

  const storageKey = options.persistence?.key ?? `${storagePrefix}${storeId}`;
  return createPersistedStore(storeId, storageKey);
}
