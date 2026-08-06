import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from 'react'

/** Built-in color theme preferences. */
export type PicodashTheme = 'light' | 'dark' | 'system'

/** Built-in preferences plus an application-declared custom theme name. */
export type PicodashThemeOption<CustomTheme extends string = never> =
  | PicodashTheme
  | (CustomTheme extends PicodashTheme | PicodashDensity ? never : CustomTheme)

/** A theme name after `system` has been resolved. */
export type PicodashResolvedTheme<CustomTheme extends string = never> =
  | 'light'
  | 'dark'
  | (CustomTheme extends PicodashTheme | PicodashDensity ? never : CustomTheme)

/** The independent presentation density axis. */
export type PicodashDensity = 'regular' | 'compact'

export interface PicodashThemeProviderProps<CustomTheme extends string = never> {
  children: ReactNode
  theme?: PicodashThemeOption<NoInfer<CustomTheme>>
  density?: PicodashDensity
}

interface ThemeContextValue {
  readonly theme: string
  readonly density: PicodashDensity
}

const PicodashThemeContext = createContext<ThemeContextValue | undefined>(undefined)
const carrierStyle = { display: 'contents' } as const
const emptySubscription = () => () => {}
const privateDarkSnapshot = () => 'dark' as const

export function PicodashThemeProvider<CustomTheme extends string = never>({
  children,
  theme,
  density,
}: PicodashThemeProviderProps<NoInfer<CustomTheme>>): ReactElement {
  const inherited = useContext(PicodashThemeContext)
  const preference: PicodashThemeOption<CustomTheme> =
    theme ?? (inherited?.theme as PicodashThemeOption<CustomTheme> | undefined) ?? 'system'
  const resolvedSystemTheme = useSyncExternalStore(
    preference === 'system' ? subscribeToSystemTheme : emptySubscription,
    preference === 'system' ? readPicodashSystemTheme : privateDarkSnapshot,
    privateDarkSnapshot,
  )
  const resolvedTheme: PicodashResolvedTheme<CustomTheme> =
    preference === 'system' ? resolvedSystemTheme : preference
  const value: ThemeContextValue = {
    theme: resolvedTheme,
    density: density ?? inherited?.density ?? 'regular',
  }
  return (
    <PicodashThemeContext.Provider value={value}>
      <div
        data-picodash-density={value.density}
        data-picodash-theme={value.theme}
        style={carrierStyle}
      >
        {children}
      </div>
    </PicodashThemeContext.Provider>
  )
}

export function usePicodashTheme(): string {
  const context = useContext(PicodashThemeContext)
  const standaloneTheme = useSyncExternalStore(
    context === undefined ? subscribeToSystemTheme : emptySubscription,
    context === undefined ? readPicodashSystemTheme : privateDarkSnapshot,
    privateDarkSnapshot,
  )
  return context?.theme ?? standaloneTheme
}

export function usePicodashDensity(): PicodashDensity {
  return useContext(PicodashThemeContext)?.density ?? 'regular'
}

function readPicodashSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function subscribeToSystemTheme(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  query.addEventListener('change', onStoreChange)
  return () => query.removeEventListener('change', onStoreChange)
}
