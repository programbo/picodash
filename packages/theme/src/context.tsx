'use client'

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import {
  picodashDefaultTheme,
  picodashThemeAttribute,
  readPicodashSystemTheme,
  type PicodashResolvedTheme,
  type PicodashThemeOption,
} from './theme.js'

const PicodashThemeContext = createContext<PicodashResolvedTheme>(picodashDefaultTheme)

export interface PicodashThemeProviderProps<CustomTheme extends string = never> {
  children: ReactNode
  /** Theme preference; custom names are accepted when declared through the generic. */
  theme?: PicodashThemeOption<CustomTheme>
  /** Optional detached portal root that should carry the resolved theme attribute. */
  portalContainer?: Element | null
}

/** Provides a resolved theme and a DOM carrier for descendants. */
export function PicodashThemeProvider<CustomTheme extends string = never>({
  children,
  portalContainer = null,
  theme: themePreference = picodashDefaultTheme,
}: PicodashThemeProviderProps<CustomTheme>) {
  const theme = useResolvedPicodashTheme(themePreference)

  useLayoutEffect(() => {
    if (!portalContainer) return

    const previousTheme = portalContainer.getAttribute(picodashThemeAttribute)
    portalContainer.setAttribute(picodashThemeAttribute, theme)

    return () => {
      if (previousTheme === null) {
        portalContainer.removeAttribute(picodashThemeAttribute)
      } else {
        portalContainer.setAttribute(picodashThemeAttribute, previousTheme)
      }
    }
  }, [portalContainer, theme])

  const contextValue = useMemo(() => theme, [theme])

  return (
    <PicodashThemeContext.Provider value={contextValue}>
      <div data-picodash-theme={theme} data-picodash-theme-root="">
        {children}
      </div>
    </PicodashThemeContext.Provider>
  )
}

/** Provides a theme to descendants without adding another DOM boundary. */
export function PicodashThemeContextProvider({
  children,
  theme,
}: {
  children: ReactNode
  theme: PicodashResolvedTheme
}) {
  return <PicodashThemeContext.Provider value={theme}>{children}</PicodashThemeContext.Provider>
}

export function usePicodashTheme(): PicodashResolvedTheme {
  return useContext(PicodashThemeContext)
}

export function useResolvedPicodashTheme<CustomTheme extends string>(
  theme: PicodashThemeOption<CustomTheme> | undefined,
): PicodashResolvedTheme {
  const inheritedTheme = usePicodashTheme()
  const preference = theme ?? inheritedTheme
  const systemTheme = useSyncExternalStore(
    preference === 'system' ? subscribeToSystemTheme : emptySystemThemeSubscription,
    readPicodashSystemTheme,
    serverSystemTheme,
  )

  return preference === 'system' ? systemTheme : preference
}

function subscribeToSystemTheme(onStoreChange: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}

  const query = window.matchMedia('(prefers-color-scheme: dark)')
  query.addEventListener('change', onStoreChange)
  return () => query.removeEventListener('change', onStoreChange)
}

function emptySystemThemeSubscription() {
  return () => {}
}

function serverSystemTheme(): 'dark' {
  return 'dark'
}
