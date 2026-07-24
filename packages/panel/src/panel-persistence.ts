import * as z from 'zod/mini'
import type { PersistStorage } from 'zustand/middleware'
import type { PicodashPersistedState } from './picodash-provider.js'
import {
  panelDockHorizontalValues,
  panelDockVerticalValues,
  panelFixedPositionValues,
  panelFloatingPositionValues,
  panelMagneticPositionValues,
} from './panel-persistence-values.js'

export const panelLayoutStorageKey = 'picodash-panel:provider-layout:v1'
export const legacyPanelLayoutStorageKey = 'tweaker-panel:provider-layout:v1'

const legacyPanelLayoutStorageKeys = new Map([
  [panelLayoutStorageKey, legacyPanelLayoutStorageKey],
  ['picodash-demo:panel-layout:v1', 'tweaker-demo:panel-layout:v1'],
  ['picodash-geometry-lab:panel-layout:v1', 'tweaker-geometry-lab:panel-layout:v1'],
  ['picodash-geometry-lab:fixed-boundaries:v1', 'tweaker-geometry-lab:fixed-boundaries:v1'],
])

const panelPositionSchema = z.object({
  dock: z._default(
    z.nullable(
      z.object({
        horizontal: z.optional(z.enum(panelDockHorizontalValues)),
        vertical: z.optional(z.enum(panelDockVerticalValues)),
      }),
    ),
    null,
  ),
  placement: z.optional(
    z.discriminatedUnion('mode', [
      z.object({
        mode: z.literal('floating'),
        position: z.optional(z.enum(panelFloatingPositionValues)),
      }),
      z.object({
        mode: z.literal('magnetic'),
        position: z.enum(panelMagneticPositionValues),
      }),
      z.object({
        mode: z.literal('fixed'),
        position: z.enum(panelFixedPositionValues),
      }),
    ]),
  ),
  x: z.number(),
  y: z.number(),
})

export const picodashPersistedStateMiniSchema = z.object({
  panelLayouts: z._default(z.record(z.string(), panelPositionSchema), {}),
})

const persistedStorageValueSchema = z.object({
  state: z.unknown(),
  version: z.optional(z.number()),
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

          const state = picodashPersistedStateMiniSchema.safeParse(parsed.data.state)
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

      const parsed = picodashPersistedStateMiniSchema.safeParse(value.state)
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
