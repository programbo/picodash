import { createStore } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  createControlPersistId,
  hasPanelEffects,
  jsonValuesEqual,
  normalizeControlEntry,
  normalizePanelEffects,
  normalizePanelId,
  normalizeSection,
  preserveSectionOrderByPanel,
  sanitizeValueForControl,
  valueForControl,
  valuesForControls,
} from '../control.js'
import {
  defaultPanelId,
  type DockState,
  type JsonValue,
  type NormalizedControl,
  type PanelAppearance,
  type PanelLayoutState,
  type PersistedState,
  type TweakerState,
  type TweakerStore,
  type TweakerStoreOptions,
} from '../types.js'
import {
  createValidatedPersistStorage,
  emptyPersistedState,
  persistedStateSchema,
  storagePrefix,
} from './persistence.js'

function controlsEqual(left: NormalizedControl[], right: NormalizedControl[]) {
  if (left.length !== right.length) return false

  return left.every((leftControl, index) => {
    const rightControl = right[index]
    if (!rightControl) return false

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
      reactNodeEqual(leftControl.help, rightControl.help) &&
      reactNodeEqual(leftControl.description, rightControl.description) &&
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
      leftControl.format === rightControl.format &&
      leftControl.readOnly === rightControl.readOnly &&
      leftControl.hidden === rightControl.hidden
    )
  })
}

function valuesEqual(left: JsonValue, right: JsonValue) {
  return jsonValuesEqual(left, right)
}

function settingsEqual(left: NormalizedControl['settings'], right: NormalizedControl['settings']) {
  return JSON.stringify(left ?? {}) === JSON.stringify(right ?? {})
}

function reactNodeEqual(left: NormalizedControl['help'], right: NormalizedControl['help']) {
  return Object.is(left, right)
}

function optionsEqual(left: NormalizedControl['options'], right: NormalizedControl['options']) {
  if (left === right) return true
  if (!left || !right || left.length !== right.length) return false

  return left.every((leftOption, index) => {
    const rightOption = right[index]
    return rightOption?.label === leftOption.label && rightOption.value === leftOption.value
  })
}

function formatOptionsEqual(
  left: NormalizedControl['formatOptions'],
  right: NormalizedControl['formatOptions'],
) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

function defaultPanelState(): PanelLayoutState {
  return { collapsed: false, dock: null }
}

function panelStateFor(state: Pick<TweakerState, 'panels'>, panelId: string): PanelLayoutState {
  return state.panels[panelId] ?? defaultPanelState()
}

function panelOrderFor(state: Pick<TweakerState, 'order'>, panelId: string) {
  return state.order[panelId] ?? {}
}

function panelSectionsFor(state: Pick<TweakerState, 'sections'>, panelId: string) {
  return state.sections[panelId] ?? {}
}

function panelAppearanceEqual(
  left: PanelAppearance | undefined,
  right: PanelAppearance | undefined,
) {
  return (
    left?.surfaceOpacity === right?.surfaceOpacity &&
    left?.activeSurfaceOpacity === right?.activeSurfaceOpacity &&
    left?.backdropBlur === right?.backdropBlur &&
    left?.activeBackdropBlur === right?.activeBackdropBlur
  )
}

function dockEqual(left: DockState | null, right: DockState | null) {
  if (left === right) return true
  if (!left || !right) return false
  return (
    left.edge === right.edge &&
    left.secondaryEdge === right.secondaryEdge &&
    left.offset === right.offset
  )
}

function orderEqual(left: string[] | undefined, right: string[]) {
  return left?.length === right.length && right.every((id, index) => left[index] === id)
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
    hiddenSections: {},

    register(schema, options = {}) {
      const panelId = normalizePanelId(options.panel)
      const section = normalizeSection(options.section)
      const reorderable = options.reorderable ?? options.sortable ?? true
      const controls = Object.entries(schema).map(([key, config]) =>
        normalizeControlEntry({
          storeId,
          panelId,
          section,
          key,
          config,
          reorderable,
        }),
      )
      const ids = new Set(controls.map((control) => control.persistId))

      set((state) => {
        const values = { ...state.values }
        let valuesChanged = false
        const controlsById = new Map(state.controls.map((control) => [control.persistId, control]))
        for (const control of controls) {
          // Sanitize restored values against the (possibly updated) control
          // configuration so dynamic bounds/options changes never leave a
          // control holding an out-of-range or invalid value. Unstored
          // controls are left alone so their default flows through naturally.
          if (Object.prototype.hasOwnProperty.call(values, control.persistId)) {
            const stored = values[control.persistId]!
            const sanitized = sanitizeValueForControl(control, stored)
            if (!jsonValuesEqual(sanitized, stored)) {
              values[control.persistId] = sanitized
              valuesChanged = true
            }
          }
          controlsById.set(control.persistId, control)
        }

        const nextControls = valuesForControls(Array.from(controlsById.values()), values)
        const nextHiddenSections = {
          ...state.hiddenSections,
          [panelId]: {
            ...state.hiddenSections[panelId],
            [section.id]: section.hidden === true,
          },
        }
        const hiddenChanged =
          state.hiddenSections[panelId]?.[section.id] !== nextHiddenSections[panelId]?.[section.id]
        if (controlsEqual(state.controls, nextControls) && !valuesChanged && !hiddenChanged)
          return state

        return {
          values,
          controls: nextControls,
          sectionOrder: preserveSectionOrderByPanel(state.sectionOrder, nextControls),
          hiddenSections: nextHiddenSections,
        }
      })

      return () => {
        set((state) => {
          const nextControls = state.controls.filter((control) => !ids.has(control.persistId))
          const sectionStillRegistered = nextControls.some(
            (control) => control.panelId === panelId && control.sectionId === section.id,
          )
          let hiddenSections = state.hiddenSections

          if (
            !sectionStillRegistered &&
            state.hiddenSections[panelId]?.[section.id] !== undefined
          ) {
            const panelHiddenSections = { ...state.hiddenSections[panelId] }
            delete panelHiddenSections[section.id]

            if (Object.keys(panelHiddenSections).length === 0) {
              const { [panelId]: _removedPanel, ...remainingHiddenSections } = state.hiddenSections
              hiddenSections = remainingHiddenSections
            } else {
              hiddenSections = {
                ...state.hiddenSections,
                [panelId]: panelHiddenSections,
              }
            }
          }

          return {
            controls: valuesForControls(nextControls, state.values),
            sectionOrder: preserveSectionOrderByPanel(state.sectionOrder, nextControls),
            hiddenSections,
          }
        })
      }
    },

    updatePanelEffects(_schema, options = {}) {
      if (!hasPanelEffects(options)) return
      const panelId = normalizePanelId(options.panel)
      const appearance = normalizePanelEffects(options)

      set((state) => {
        const nextAppearance = {
          ...state.panelAppearances[panelId],
          ...appearance,
        }
        if (panelAppearanceEqual(state.panelAppearances[panelId], nextAppearance)) return state

        return {
          panelAppearances: {
            ...state.panelAppearances,
            [panelId]: nextAppearance,
          },
        }
      })
    },

    setValue(persistId, value) {
      const control = get().controls.find((item) => item.persistId === persistId)
      if (!control) return
      if (control.readOnly) return
      if (control.kind === 'display') return

      const nextValue = sanitizeValueForControl(control, value)
      if (jsonValuesEqual(control.value, nextValue)) return

      set((state) => {
        const controlIndex = state.controls.findIndex((item) => item.persistId === persistId)
        const control = state.controls[controlIndex]
        if (!control || control.readOnly || control.kind === 'display') return state

        const sanitized = sanitizeValueForControl(control, value)
        if (jsonValuesEqual(control.value, sanitized)) return state

        const values = { ...state.values, [persistId]: sanitized }
        const controls = state.controls.slice()
        controls[controlIndex] = { ...control, value: valueForControl(control, values) }

        return {
          values,
          controls,
        }
      })
    },

    setPanelCollapsed(panelId, collapsed) {
      set((state) => {
        const current = panelStateFor(state, panelId)
        if (current.collapsed === collapsed) return state

        return {
          panels: {
            ...state.panels,
            [panelId]: { ...current, collapsed },
          },
        }
      })
    },

    setSectionCollapsed(panelId, sectionId, collapsed) {
      set((state) => {
        const panelSections = panelSectionsFor(state, panelId)
        if ((panelSections[sectionId] ?? false) === collapsed) return state

        return {
          sections: {
            ...state.sections,
            [panelId]: {
              ...panelSections,
              [sectionId]: collapsed,
            },
          },
        }
      })
    },

    setAllSectionsCollapsed(panelId, collapsed) {
      set((state) => {
        const ids = state.sectionOrder[panelId] ?? []
        const panelSections = panelSectionsFor(state, panelId)
        const next = { ...panelSections }
        let changed = false
        for (const sectionId of ids) next[sectionId] = collapsed
        for (const sectionId of ids) {
          if ((panelSections[sectionId] ?? false) !== collapsed) {
            changed = true
            break
          }
        }
        if (!changed) return state

        return {
          sections: {
            ...state.sections,
            [panelId]: next,
          },
        }
      })
    },

    setPanelDock(panelId, dock) {
      set((state) => {
        const current = panelStateFor(state, panelId)
        if (dockEqual(current.dock, dock)) return state

        return {
          panels: {
            ...state.panels,
            [panelId]: { ...current, dock },
          },
        }
      })
    },

    setSectionOrder(panelId, sectionId, ids) {
      set((state) => {
        const panelOrder = panelOrderFor(state, panelId)
        if (orderEqual(panelOrder[sectionId], ids)) return state

        return {
          order: {
            ...state.order,
            [panelId]: {
              ...panelOrder,
              [sectionId]: ids,
            },
          },
        }
      })
    },

    resetValues(panelId) {
      set((state) => {
        let values: Record<string, JsonValue>
        if (panelId === undefined) {
          values = {}
        } else {
          const panelControlIds = new Set(
            state.controls
              .filter((control) => control.panelId === panelId)
              .map((control) => control.persistId),
          )
          values = Object.fromEntries(
            Object.entries(state.values).filter(([id]) => !panelControlIds.has(id)),
          )
        }

        return {
          values,
          controls: valuesForControls(state.controls, values),
        }
      })
    },

    resetOrder(panelId) {
      if (panelId === undefined) {
        set({ order: {} })
        return
      }

      set((state) => {
        const { [panelId]: _removed, ...order } = state.order
        return { order }
      })
    },

    getControlId(panelId, sectionId, key, explicitControlId) {
      return createControlPersistId(
        storeId,
        normalizePanelId(panelId),
        { id: sectionId, label: sectionId },
        key,
        explicitControlId,
      )
    },

    getPanelState(panelId) {
      return panelStateFor(get(), panelId)
    },
  })
}

function createMemoryStore(storeId: string): TweakerStore {
  return createStore<TweakerState>()(createBaseState(storeId))
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
        const parsed = persistedStateSchema.safeParse(persistedState)
        if (!parsed.success) return currentState
        const persisted = parsed.data as PersistedState

        return {
          ...currentState,
          ...persisted,
          controls: valuesForControls(currentState.controls, persisted.values),
        }
      },
    }),
  )
}

export function createTweakerStore(options: TweakerStoreOptions): TweakerStore {
  const storeId = options.id ?? options.storeId ?? defaultPanelId
  if (options.persistence === false) return createMemoryStore(storeId)

  const storageKey = options.persistence?.key ?? `${storagePrefix}${storeId}`
  return createPersistedStore(storeId, storageKey)
}
