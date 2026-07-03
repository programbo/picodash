import { z } from 'zod'
import type { PersistStorage } from 'zustand/middleware'
import type { TweakerPersistedState } from './tweaker-provider.js'

export const panelLayoutStorageKey = 'tweaker-panel:provider-layout:v1'

const panelPositionSchema = z.object({
  dock: z
    .object({
      horizontal: z.enum(['left', 'right']).optional(),
      vertical: z.enum(['bottom', 'top']).optional(),
    })
    .nullable()
    .default(null),
  x: z.number().finite(),
  y: z.number().finite(),
})

export const tweakerPersistedStateSchema = z.object({
  panelLayouts: z.record(z.string(), panelPositionSchema).default({}),
})

const persistedStorageValueSchema = z.object({
  state: z.unknown(),
  version: z.number().optional(),
})

export function emptyTweakerPersistedState(): TweakerPersistedState {
  return { panelLayouts: {} }
}

export function createValidatedPanelPersistStorage(): PersistStorage<TweakerPersistedState> {
  return {
    getItem(name) {
      if (typeof window === 'undefined') return null

      try {
        const raw = window.localStorage.getItem(name)
        if (!raw) return null

        const parsed = persistedStorageValueSchema.safeParse(JSON.parse(raw))
        if (!parsed.success) return null

        const state = tweakerPersistedStateSchema.safeParse(parsed.data.state)
        return state.success ? { state: state.data, version: parsed.data.version } : null
      } catch {
        return null
      }
    },
    setItem(name, value) {
      if (typeof window === 'undefined') return

      const parsed = tweakerPersistedStateSchema.safeParse(value.state)
      if (!parsed.success) return

      window.localStorage.setItem(
        name,
        JSON.stringify({ state: parsed.data, version: value.version }),
      )
    },
    removeItem(name) {
      if (typeof window === 'undefined') return
      window.localStorage.removeItem(name)
    },
  }
}
