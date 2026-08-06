import { createContext, useContext, type ReactNode } from 'react'

const ActiveLayerContext = createContext<string | undefined>(undefined)

function layerToken(name: string) {
  return name.startsWith('var(') ? name : `var(--picodash-layer-${name})`
}

export function resolveOverlayLayer(
  overlay: string,
  layerBase: number | undefined,
  parentLayer: string | undefined,
) {
  const token = layerToken(overlay)
  const base = layerBase === undefined ? token : `max(${token}, ${layerBase})`
  if (parentLayer === undefined) return base
  const nested = `calc(${parentLayer} + 1)`
  return layerBase === undefined
    ? `max(${token}, ${nested})`
    : `max(${token}, ${layerBase}, ${nested})`
}

export function useActiveOverlayLayer() {
  return useContext(ActiveLayerContext)
}

export function ActiveOverlayLayer({ value, children }: { value: string; children: ReactNode }) {
  return <ActiveLayerContext.Provider value={value}>{children}</ActiveLayerContext.Provider>
}

export function resolveDialogLayer(layerBase: number | undefined, parentLayer: string | undefined) {
  return resolveOverlayLayer('dialog', layerBase, parentLayer)
}

export const useActiveDialogLayer = useActiveOverlayLayer
export const ActiveDialogLayer = ActiveOverlayLayer
