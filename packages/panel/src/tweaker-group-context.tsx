import { createContext, useContext, type ReactNode } from 'react'
import type { TweakerGroupContextValue } from './tweaker-panel-types.js'

const TweakerGroupContext = createContext<TweakerGroupContextValue | null>(null)

export function TweakerGroupContextProvider({
  children,
  value,
}: {
  children: ReactNode
  value: TweakerGroupContextValue
}) {
  return <TweakerGroupContext.Provider value={value}>{children}</TweakerGroupContext.Provider>
}

export function useTweakerGroupContext() {
  const context = useContext(TweakerGroupContext)
  if (!context) {
    throw new Error('Tweaker controls must be rendered inside TweakerPanel or TweakerGroup.')
  }
  return context
}
