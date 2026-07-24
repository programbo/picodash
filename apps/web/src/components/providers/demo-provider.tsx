'use client'

import { usePathname } from 'next/navigation'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import {
  PicodashProvider,
  usePicodashPanelStoreSelector,
  usePicodashTheme,
  type PicodashGradientValue,
} from '@picodash/panel'
import { gradientCssValue } from '@picodash/panel/advanced'
import {
  BuiltInItemsPanel,
  builtInItemsPanelStore,
  defaultBuiltInItemsExampleConfig,
  type BuiltInItemsExampleConfig,
} from '@/components/items/built-in/built-in-items-panel'

export type DemoThemes = {
  custom?: string
  provider?: string
  scene?: string
}

type DemoThemeOverrides = {
  [Key in keyof DemoThemes]?: string | null
}

type DemoContextValue = {
  builtInExampleConfig: BuiltInItemsExampleConfig
  setBuiltInExampleConfig: Dispatch<SetStateAction<BuiltInItemsExampleConfig>>
  setProviderTheme: (theme: string) => void
  themes: DemoThemes
}

const DemoContext = createContext<DemoContextValue | null>(null)
const providerThemeStorageKey = 'picodash-demo:provider-theme:v1'

export function DemoProvider({
  children,
  initialThemes = {},
}: {
  children: ReactNode
  initialThemes?: DemoThemes
}) {
  const pathname = usePathname()
  const [themeOverrides, setThemeOverrides] = useState<DemoThemeOverrides>({})
  const [builtInExampleConfig, setBuiltInExampleConfig] = useState<BuiltInItemsExampleConfig>(
    defaultBuiltInItemsExampleConfig,
  )
  const themes = useMemo(
    () => mergeThemes(initialThemes, themeOverrides),
    [initialThemes.custom, initialThemes.provider, initialThemes.scene, themeOverrides],
  )
  const route =
    pathname === '/lab/state' || pathname.startsWith('/lab/state/') ? 'state-lab' : 'home'

  useEffect(() => {
    if (initialThemes.provider !== undefined) return

    try {
      const persistedTheme = normalizeDemoTheme(
        window.localStorage.getItem(providerThemeStorageKey),
      )
      if (!persistedTheme) return

      setThemeOverrides((current) =>
        Object.hasOwn(current, 'provider') ? current : { ...current, provider: persistedTheme },
      )
    } catch {
      // Browser storage can be disabled; the in-memory theme still works.
    }
  }, [initialThemes.provider])

  useEffect(() => {
    const handleThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<DemoThemeOverrides>).detail
      setThemeOverrides((current) => ({ ...current, ...detail }))
    }

    window.addEventListener('picodash-demo-theme-change', handleThemeChange)
    return () => window.removeEventListener('picodash-demo-theme-change', handleThemeChange)
  }, [])

  const contextValue = useMemo<DemoContextValue>(
    () => ({
      builtInExampleConfig,
      setBuiltInExampleConfig,
      setProviderTheme: (provider) => {
        setThemeOverrides((current) => ({ ...current, provider }))
        try {
          window.localStorage.setItem(providerThemeStorageKey, provider)
        } catch {
          // Browser storage can be disabled; the in-memory theme still works.
        }
      },
      themes,
    }),
    [builtInExampleConfig, themes],
  )

  return (
    <>
      <a
        className="bg-primary text-primary-foreground fixed top-2 left-2 z-(--picodash-layer-viewer) -translate-y-16 px-3 py-2 text-sm font-medium transition-transform focus:translate-y-0 focus:outline-none"
        href="#main-content"
      >
        Skip to main content
      </a>
      <main
        id="main-content"
        className={
          route === 'home'
            ? 'dark bg-background text-foreground relative h-svh overflow-hidden'
            : 'dark bg-background text-foreground relative min-h-svh overflow-x-hidden'
        }
        data-product-route={route}
        data-persistent-demo-shell
      >
        <PicodashProvider
          persistLayout
          storageKey="picodash-demo:panel-layout:v1"
          theme={themes.provider ?? 'dark'}
        >
          <DemoContext value={contextValue}>
            <DemoBackground />
            {children}
            <BuiltInItemsPanel config={builtInExampleConfig} />
          </DemoContext>
        </PicodashProvider>
      </main>
    </>
  )
}

export function useDemoContext() {
  const context = useContext(DemoContext)
  if (!context) throw new Error('useDemoContext must be used inside DemoProvider')
  return context
}

function DemoBackground() {
  const resolvedProviderTheme = usePicodashTheme()
  const backgroundGradient = usePicodashPanelStoreSelector(
    builtInItemsPanelStore,
    (state) => state.values.gradient,
  )
  const backgroundRotation = usePicodashPanelStoreSelector(
    builtInItemsPanelStore,
    (state) => state.values.gradientRotation,
  )

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        data-demo-background
        style={{
          backgroundImage: gradientCssValue(
            backgroundGradient as PicodashGradientValue,
            typeof backgroundRotation === 'number' ? backgroundRotation : 135,
          ),
        }}
      />
      <span data-demo-provider-theme={resolvedProviderTheme} hidden />
    </>
  )
}

function mergeThemes(routeThemes: DemoThemes, overrides: DemoThemeOverrides): DemoThemes {
  return {
    custom: themeValue('custom', routeThemes, overrides),
    provider: themeValue('provider', routeThemes, overrides),
    scene: themeValue('scene', routeThemes, overrides),
  }
}

function themeValue(key: keyof DemoThemes, routeThemes: DemoThemes, overrides: DemoThemeOverrides) {
  const theme = Object.hasOwn(overrides, key) ? (overrides[key] ?? undefined) : routeThemes[key]
  return normalizeDemoTheme(theme)
}

function normalizeDemoTheme(theme: string | null | undefined) {
  return theme === 'cyber' ? 'tron' : (theme ?? undefined)
}
