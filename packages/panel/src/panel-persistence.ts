import { z } from 'zod'
import type { PersistStorage } from 'zustand/middleware'
import type { PicodashPersistedState } from './picodash-provider.js'

export const panelLayoutStorageKey = 'picodash-panel:provider-layout:v1'

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
        const raw = window.localStorage.getItem(name)
        if (!raw) return null

        const parsed = persistedStorageValueSchema.safeParse(JSON.parse(raw))
        if (!parsed.success) return null

        const state = picodashPersistedStateSchema.safeParse(parsed.data.state)
        return state.success ? { state: state.data, version: parsed.data.version } : null
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
      try {
        window.localStorage.removeItem(name)
      } catch {
        // Keep provider state usable when browser storage is unavailable.
      }
    },
  }
}
