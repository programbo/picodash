import { z } from 'zod'
import type { PersistStorage } from 'zustand/middleware'
import { defaultPanelId, type PersistedState } from '../types.js'

export const storagePrefix = 'tweaker:'

const jsonValueSchema: z.ZodType = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
)

const dockStateSchema = z.object({
  edge: z.enum(['top', 'right', 'bottom', 'left']),
  secondaryEdge: z.enum(['top', 'right', 'bottom', 'left']).optional(),
  offset: z.number().finite().nonnegative(),
})

const panelLayoutStateSchema = z.object({
  collapsed: z.boolean().default(false),
  dock: dockStateSchema.nullable().default(null),
})

export const persistedStateSchema = z.object({
  values: z.record(z.string(), jsonValueSchema).default({}),
  order: z.record(z.string(), z.record(z.string(), z.array(z.string()))).default({}),
  panels: z.record(z.string(), panelLayoutStateSchema).default({}),
  sections: z.record(z.string(), z.record(z.string(), z.boolean())).default({}),
})

const legacyPersistedStateSchema = z.object({
  values: z.record(z.string(), jsonValueSchema).default({}),
  order: z.record(z.string(), z.array(z.string())).default({}),
  collapsed: z.boolean().default(false),
  dock: dockStateSchema.nullable().default(null),
})

const persistedStorageValueSchema = z.object({
  state: z.unknown(),
  version: z.number().optional(),
})

export function emptyPersistedState(): PersistedState {
  return { values: {}, order: {}, panels: {}, sections: {} }
}

function parsePersistedState(state: unknown): PersistedState | null {
  if (state && typeof state === 'object' && ('collapsed' in state || 'dock' in state)) {
    const legacy = legacyPersistedStateSchema.safeParse(state)
    if (!legacy.success) return null

    return {
      values: legacy.data.values as PersistedState['values'],
      order: { [defaultPanelId]: legacy.data.order },
      panels: {
        [defaultPanelId]: {
          collapsed: legacy.data.collapsed,
          dock: legacy.data.dock,
        },
      },
      sections: {},
    }
  }

  const parsed = persistedStateSchema.safeParse(state)
  if (parsed.success) return parsed.data as PersistedState

  const legacy = legacyPersistedStateSchema.safeParse(state)
  if (!legacy.success) return null

  return {
    values: legacy.data.values as PersistedState['values'],
    order: { [defaultPanelId]: legacy.data.order },
    panels: {
      [defaultPanelId]: {
        collapsed: legacy.data.collapsed,
        dock: legacy.data.dock,
      },
    },
    sections: {},
  }
}

export function createValidatedPersistStorage(): PersistStorage<PersistedState> {
  return {
    getItem(name) {
      if (typeof window === 'undefined') return null

      try {
        const raw = window.localStorage.getItem(name)
        if (!raw) return null

        const parsed = persistedStorageValueSchema.safeParse(JSON.parse(raw))
        if (!parsed.success) return null

        const state = parsePersistedState(parsed.data.state)
        return state ? { state, version: parsed.data.version } : null
      } catch {
        return null
      }
    },
    setItem(name, value) {
      if (typeof window === 'undefined') return

      const parsed = persistedStateSchema.safeParse(value.state)
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
