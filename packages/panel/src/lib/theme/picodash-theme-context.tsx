import { createContext, useContext, type ReactNode } from 'react'
import { picodashDefaultTheme } from './theme.js'

const PicodashThemeContext = createContext(picodashDefaultTheme)

export function PicodashThemeContextProvider({
  children,
  theme,
}: {
  children: ReactNode
  theme: string
}) {
  return <PicodashThemeContext.Provider value={theme}>{children}</PicodashThemeContext.Provider>
}

export function usePicodashTheme() {
  return useContext(PicodashThemeContext)
}

export function useResolvedPicodashTheme(theme: string | undefined) {
  const inheritedTheme = usePicodashTheme()
  return theme ?? inheritedTheme
}
