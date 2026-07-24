import { createContext, useContext, type ReactNode } from 'react'
import type { PicodashGroupContextValue } from '../panel/picodash-panel-types.js'

const PicodashGroupContext = createContext<PicodashGroupContextValue | null>(null)

export function PicodashGroupContextProvider({
  children,
  value,
}: {
  children: ReactNode
  value: PicodashGroupContextValue
}) {
  return <PicodashGroupContext.Provider value={value}>{children}</PicodashGroupContext.Provider>
}

export function usePicodashGroupContext() {
  const context = useContext(PicodashGroupContext)
  if (!context) {
    throw new Error('Picodash controls must be rendered inside PicodashPanel or PicodashGroup.')
  }
  return context
}
