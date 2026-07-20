import { createContext, useContext, type ReactNode } from 'react'
import { tweakerDefaultTheme } from './theme.js'

const TweakerThemeContext = createContext(tweakerDefaultTheme)

export function TweakerThemeContextProvider({
  children,
  theme,
}: {
  children: ReactNode
  theme: string
}) {
  return <TweakerThemeContext.Provider value={theme}>{children}</TweakerThemeContext.Provider>
}

export function useTweakerTheme() {
  return useContext(TweakerThemeContext)
}

export function useResolvedTweakerTheme(theme: string | undefined) {
  const inheritedTheme = useTweakerTheme()
  return theme ?? inheritedTheme
}
