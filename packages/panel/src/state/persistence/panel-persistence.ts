import * as z from 'zod/mini'
import type { PersistStorage } from 'zustand/middleware'
import type { PicodashPersistedState } from '../provider/picodash-provider.js'
import {
  panelDockedPositionValues,
  panelHybridDockPositionValues,
  panelHybridSnapPositionValues,
  panelSnappedPositionValues,
} from './panel-persistence-values.js'

export const panelLayoutStorageKey = 'picodash-panel:provider-layout:v2'

const pointSchema = z.object({ x: z.number(), y: z.number() })
const freeDispositionSchema = z.object({ kind: z.literal('free') })
const snappedDispositionSchema = z.object({
  kind: z.literal('snapped'),
  position: z.enum(panelSnappedPositionValues),
})
const dockedDispositionSchema = z.object({
  kind: z.literal('docked'),
  position: z.enum(panelDockedPositionValues),
})
const panelPlacementSchema = z.discriminatedUnion('mode', [
  z.object({
    disposition: z.union([freeDispositionSchema, snappedDispositionSchema]),
    mode: z.literal('floating'),
  }),
  z.object({
    disposition: dockedDispositionSchema,
    mode: z.literal('fixed'),
  }),
  z.object({
    disposition: z.union([
      freeDispositionSchema,
      z.object({
        kind: z.literal('snapped'),
        position: z.enum(panelHybridSnapPositionValues),
      }),
      z.object({
        kind: z.literal('docked'),
        position: z.enum(panelHybridDockPositionValues),
      }),
    ]),
    mode: z.literal('hybrid'),
  }),
])
const panelLayoutSchema = z.object({
  placement: panelPlacementSchema,
  preferredCoordinates: pointSchema,
})

export const picodashPersistedStateMiniSchema = z.object({
  panelLayouts: z._default(z.record(z.string(), panelLayoutSchema), {}),
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
        const raw = window.localStorage.getItem(name)
        if (!raw) return null

        let parsedJson: unknown
        try {
          parsedJson = JSON.parse(raw)
        } catch {
          removeInvalidStoredLayout(name)
          return null
        }

        const parsed = persistedStorageValueSchema.safeParse(parsedJson)
        if (!parsed.success) {
          removeInvalidStoredLayout(name)
          return null
        }

        const state = picodashPersistedStateMiniSchema.safeParse(parsed.data.state)
        if (!state.success) {
          removeInvalidStoredLayout(name)
          return null
        }
        return { state: state.data, version: parsed.data.version }
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
      try {
        window.localStorage.removeItem(name)
      } catch {
        // Keep provider state usable when browser storage is unavailable.
      }
    },
  }
}

function removeInvalidStoredLayout(name: string) {
  try {
    window.localStorage.removeItem(name)
  } catch {
    // Invalid persistence is ignored when browser storage is unavailable.
  }
}
