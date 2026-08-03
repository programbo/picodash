import { createContext, useContext } from 'react'
import type { StoreApi } from 'zustand'

export interface PicodashListProviderContextValue {
  portalContainer?: HTMLElement | null
  store: StoreApi<{ panelOrder?: readonly string[] }>
}

export type PicodashProviderContextValue = PicodashListProviderContextValue

const PicodashListProviderContext = createContext<PicodashListProviderContextValue | null>(null)

export function useOptionalPicodashProviderContext() {
  return useContext(PicodashListProviderContext)
}

export function portalLayerZIndexForState(
  _state: { panelOrder?: readonly string[] },
  _offset: number,
) {
  return undefined
}
