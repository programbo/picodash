import { createContext, useContext, useMemo, useRef } from 'react'
import { useStore } from 'zustand'
import { builtinControls } from '../extensions/builtin-controls.js'
import { mergeTweakerControls } from '../extensions/registry.js'
import { createTweakerStore } from '../store/create-tweaker-store.js'
import {
  defaultPanelId,
  type TweakerCustomControlComponent,
  type TweakerProviderProps,
  type TweakerControlRegistry,
  type TweakerSnapshot,
  type TweakerState,
  type TweakerStore,
} from '../types.js'

interface TweakerContextValue {
  store: TweakerStore
  controls: TweakerControlRegistry
}

const TweakerContext = createContext<TweakerContextValue | null>(null)
const emptyControls: TweakerControlRegistry = {}

function warnDeniedBuiltInOverride(type: string) {
  const nodeEnv = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
    ?.NODE_ENV
  if (nodeEnv === 'production') return
  console.warn(
    `[tweaker] Ignoring custom control type "${type}" because it would override a built-in control. Pass overrideBuiltIns to TweakerProvider to allow this intentionally.`,
  )
}

function filterBuiltInOverrides(
  controls: TweakerControlRegistry | Record<string, TweakerCustomControlComponent>,
): TweakerControlRegistry {
  const userControls = mergeTweakerControls(controls)
  const filtered: TweakerControlRegistry = {}

  for (const [type, definition] of Object.entries(userControls)) {
    if (builtinControls[type]) {
      warnDeniedBuiltInOverride(type)
      continue
    }
    filtered[type] = definition
  }

  return filtered
}

export function TweakerProvider({
  children,
  id,
  storeId,
  persistence,
  controls = emptyControls,
  overrideBuiltIns = false,
}: TweakerProviderProps) {
  const storeRef = useRef<TweakerStore | null>(null)
  const resolvedId = id ?? storeId ?? defaultPanelId

  if (!storeRef.current) {
    storeRef.current = createTweakerStore({ id: resolvedId, persistence })
  }
  const registry = useMemo(
    () =>
      overrideBuiltIns
        ? mergeTweakerControls(builtinControls, controls)
        : mergeTweakerControls(builtinControls, filterBuiltInOverrides(controls)),
    [controls, overrideBuiltIns],
  )

  return (
    <TweakerContext.Provider value={{ store: storeRef.current, controls: registry }}>
      {children}
    </TweakerContext.Provider>
  )
}

function useTweakerContext() {
  const context = useContext(TweakerContext)
  if (!context) {
    throw new Error('Tweaker components must be rendered inside TweakerProvider.')
  }
  return context
}

export function useTweakerStoreApi() {
  return useTweakerContext().store
}

export function useTweakerCustomControls() {
  return useTweakerContext().controls
}

export function useTweakerStore() {
  return useStore(useTweakerStoreApi())
}

export function useTweakerSelector<T>(selector: (state: TweakerState) => T) {
  return useStore(useTweakerStoreApi(), selector)
}

export function useTweakerSnapshot() {
  return useStore(useTweakerStoreApi()) as TweakerSnapshot
}
