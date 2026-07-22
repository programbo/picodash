import { z } from 'zod'
import type { PersistStorage } from 'zustand/middleware'
import type { PicodashPersistedState } from './picodash-provider.js'

export const panelLayoutStorageKey = 'picodash-panel:provider-layout:v1'
export const legacyPanelLayoutStorageKey = 'tweaker-panel:provider-layout:v1'

const legacyPanelLayoutStorageKeys = new Map([
  [panelLayoutStorageKey, legacyPanelLayoutStorageKey],
  ['picodash-demo:panel-layout:v1', 'tweaker-demo:panel-layout:v1'],
  ['picodash-geometry-lab:panel-layout:v1', 'tweaker-geometry-lab:panel-layout:v1'],
  ['picodash-geometry-lab:fixed-boundaries:v1', 'tweaker-geometry-lab:fixed-boundaries:v1'],
])

const panelPositionSchema = z.object({
  dock: z
    .object({
      horizontal: z.enum(['left', 'right']).optional(),
      vertical: z.enum(['bottom', 'top']).optional(),
    })
    .nullable()
    .default(null),
  placement: z
    .discriminatedUnion('mode', [
      z.object({
        mode: z.literal('floating'),
        position: z.enum(['bottom-left', 'bottom-right', 'top-left', 'top-right']).optional(),
      }),
      z.object({
        mode: z.literal('magnetic'),
        position: z.enum([
          'top-left',
          'top',
          'top-right',
          'right',
          'bottom-right',
          'bottom',
          'bottom-left',
          'left',
        ]),
      }),
      z.object({
        mode: z.literal('fixed'),
        position: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right', 'left', 'right']),
      }),
    ])
    .optional(),
  x: z.number().finite(),
  y: z.number().finite(),
})

export const picodashPersistedStateSchema = z.object({
  panelLayouts: z.record(z.string(), panelPositionSchema).default({}),
})

const persistedStorageValueSchema = z.object({
  state: z.unknown(),
  version: z.number().optional(),
})

export function emptyPicodashPersistedState(): PicodashPersistedState {
  return { panelLayouts: {} }
}

export function createValidatedPanelPersistStorage(): PersistStorage<PicodashPersistedState> {
  return {
    getItem(name) {
      if (typeof window === 'undefined') return null

      try {
        const legacyStorageKey = legacyPanelLayoutStorageKeys.get(name)
        const storageKeys = legacyStorageKey ? [name, legacyStorageKey] : [name]
        for (const storageKey of storageKeys) {
          const raw = window.localStorage.getItem(storageKey)
          if (!raw) continue

          let parsedJson: unknown
          try {
            parsedJson = JSON.parse(raw)
          } catch {
            continue
          }

          const parsed = persistedStorageValueSchema.safeParse(parsedJson)
          if (!parsed.success) continue

          const state = picodashPersistedStateSchema.safeParse(parsed.data.state)
          if (!state.success) continue

          if (storageKey !== name) {
            try {
              window.localStorage.setItem(
                name,
                JSON.stringify({ state: state.data, version: parsed.data.version }),
              )
            } catch {
              // Migration is best-effort. The valid legacy state still hydrates the provider.
            }
          }
          return { state: state.data, version: parsed.data.version }
        }
        return null
      } catch {
        return null
      }
    },
    setItem(name, value) {
      if (typeof window === 'undefined') return

      const parsed = picodashPersistedStateSchema.safeParse(value.state)
      if (!parsed.success) return

      try {
        window.localStorage.setItem(
          name,
          JSON.stringify({ state: parsed.data, version: value.version }),
        )
      } catch {
        // Layout persistence is best-effort. Storage can be unavailable or full.
      }
    },
    removeItem(name) {
      if (typeof window === 'undefined') return
      const legacyStorageKey = legacyPanelLayoutStorageKeys.get(name)
      const storageKeys = legacyStorageKey ? [name, legacyStorageKey] : [name]
      for (const storageKey of storageKeys) {
        try {
          window.localStorage.removeItem(storageKey)
        } catch {
          // Keep provider state usable when browser storage is unavailable.
        }
      }
    },
  }
}
