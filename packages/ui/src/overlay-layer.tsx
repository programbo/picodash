import { createContext, useContext, type ReactNode } from 'react'

const dialogLayerToken = 'var(--picodash-layer-dialog)'

const ActiveLayerContext = createContext<string | undefined>(undefined)

export function resolveDialogLayer(layerBase: number | undefined, parentLayer: string | undefined) {
  const base = layerBase === undefined ? dialogLayerToken : `max(${dialogLayerToken}, ${layerBase})`
  if (parentLayer === undefined) return base
  const nested = `calc(${parentLayer} + 1)`
  return layerBase === undefined
    ? `max(${dialogLayerToken}, ${nested})`
    : `max(${dialogLayerToken}, ${layerBase}, ${nested})`
}

export function useActiveDialogLayer() {
  return useContext(ActiveLayerContext)
}

export function ActiveDialogLayer({ value, children }: { value: string; children: ReactNode }) {
  return <ActiveLayerContext.Provider value={value}>{children}</ActiveLayerContext.Provider>
}
