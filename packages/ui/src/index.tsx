import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from 'react'
import { UNSAFE_PortalProvider } from 'react-aria'
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './button.tsx'

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

/**
 * Resolves a color theme and density for descendants without owning persistence
 * or any application state.
 */
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

/** Reads the resolved color theme; outside a Provider it follows the system preference. */
export function usePicodashTheme(): string {
  const context = useContext(PicodashThemeContext)
  const standaloneTheme = useSyncExternalStore(
    context === undefined ? subscribeToSystemTheme : emptySubscription,
    context === undefined ? readPicodashSystemTheme : privateDarkSnapshot,
    privateDarkSnapshot,
  )
  return context?.theme ?? standaloneTheme
}

/** Reads the resolved density; outside a Provider it is `regular`. */
export function usePicodashDensity(): PicodashDensity {
  return useContext(PicodashThemeContext)?.density ?? 'regular'
}

export interface PicodashOverlayProviderProps {
  children: ReactNode
  portalContainer?: HTMLElement | null
  layerBase?: number
}

export interface PicodashOverlayDefaults {
  readonly portalContainer: HTMLElement | null
  readonly layerBase?: number
}

const PicodashOverlayContext = createContext<PicodashOverlayDefaults | undefined>(undefined)

function defaultPortalContainer(): HTMLElement | null {
  return typeof document !== 'undefined' && document.body ? document.body : null
}

function validateLayerBase(layerBase: number): number {
  if (!Number.isFinite(layerBase) || !Number.isInteger(layerBase)) {
    throw new TypeError('PicodashOverlayProvider layerBase must be a finite integer')
  }
  return layerBase
}

function resolvedOverlayDefaults(
  props: Pick<PicodashOverlayProviderProps, 'portalContainer' | 'layerBase'>,
  inherited: PicodashOverlayDefaults | undefined,
): PicodashOverlayDefaults {
  const portalContainer =
    props.portalContainer === undefined
      ? inherited
        ? inherited.portalContainer
        : defaultPortalContainer()
      : (props.portalContainer ?? defaultPortalContainer())
  const layerBase =
    props.layerBase === undefined ? inherited?.layerBase : validateLayerBase(props.layerBase)
  return Object.freeze({ portalContainer, layerBase })
}

/** Provides product-neutral defaults for detached overlay primitives. */
export function PicodashOverlayProvider({
  children,
  portalContainer,
  layerBase,
}: PicodashOverlayProviderProps): ReactElement {
  const inherited = useContext(PicodashOverlayContext)
  const defaults = resolvedOverlayDefaults({ portalContainer, layerBase }, inherited)
  const bridgeProps =
    defaults.portalContainer === null
      ? { getContainer: null }
      : { getContainer: () => defaults.portalContainer }

  return (
    <PicodashOverlayContext.Provider value={defaults}>
      <UNSAFE_PortalProvider {...bridgeProps}>{children}</UNSAFE_PortalProvider>
    </PicodashOverlayContext.Provider>
  )
}

/** Reads resolved overlay defaults; outside a Provider it returns standalone defaults. */
export function usePicodashOverlayDefaults(): Readonly<PicodashOverlayDefaults> {
  return (
    useContext(PicodashOverlayContext) ??
    Object.freeze({ portalContainer: defaultPortalContainer() })
  )
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
