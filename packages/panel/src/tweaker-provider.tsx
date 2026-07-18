import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createStore, useStore, type StateCreator, type StoreApi } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  createValidatedPanelPersistStorage,
  emptyTweakerPersistedState,
  panelLayoutStorageKey,
  tweakerPersistedStateSchema,
} from './panel-persistence.js'
import type { PanelLayout, PanelRect } from './panel-snapping.js'
import { tweakerDefaultTheme, tweakerLayerTokens } from './theme.js'

export interface TweakerPanelRegistration {
  id: string
}

export interface TweakerPersistedState {
  panelLayouts: Record<string, PanelLayout>
}

export interface TweakerState {
  panelLayouts: Record<string, PanelLayout>
  panelOrder: string[]
  panelRects: Record<string, PanelRect>
  panels: Record<string, TweakerPanelRegistration>
  activatePanel: (panelId: string) => void
  registerPanel: (panel: TweakerPanelRegistration) => void
  setPanelLayout: (panelId: string, layout: PanelLayout) => void
  setPanelRect: (panelId: string, rect: PanelRect | null) => void
  unregisterPanel: (panelId: string) => void
}

export type TweakerStore = StoreApi<TweakerState>

export interface TweakerProviderContextValue {
  containerElement: HTMLDivElement | null
  portalContainer: HTMLElement | null
  theme: TweakerResolvedTheme
  store: TweakerStore
}

export type TweakerTheme = 'dark' | 'light' | 'system'
export type TweakerResolvedTheme = Exclude<TweakerTheme, 'system'>

export interface TweakerProviderProps {
  children: ReactNode
  persistLayout?: boolean
  portalContainer?: HTMLElement | null
  storageKey?: string
  theme?: TweakerTheme
}

const TweakerContext = createContext<TweakerProviderContextValue | null>(null)
const panelZIndexBase = tweakerLayerTokens.panelBase

export function createTweakerStore({
  persistLayout = true,
  storageKey = panelLayoutStorageKey,
}: {
  persistLayout?: boolean
  storageKey?: string
} = {}): TweakerStore {
  const createState: StateCreator<TweakerState> = (set) => ({
    ...emptyTweakerPersistedState(),
    panelOrder: [],
    panelRects: {},
    panels: {},
    activatePanel(panelId: string) {
      set((state) => {
        if (!state.panels[panelId]) return state

        const previousIndex = state.panelOrder.indexOf(panelId)
        if (previousIndex === state.panelOrder.length - 1) return state

        return {
          panelOrder: [...state.panelOrder.filter((id) => id !== panelId), panelId],
        }
      })
    },
    registerPanel(panel: TweakerPanelRegistration) {
      set((state) => {
        const panelOrder = state.panelOrder.includes(panel.id)
          ? state.panelOrder
          : [...state.panelOrder, panel.id]

        return {
          panelOrder,
          panels: {
            ...state.panels,
            [panel.id]: panel,
          },
        }
      })
    },
    setPanelLayout(panelId: string, layout: PanelLayout) {
      set((state) => {
        const current = state.panelLayouts[panelId]
        if (
          current?.dock?.horizontal === layout.dock?.horizontal &&
          current?.dock?.vertical === layout.dock?.vertical &&
          current?.x === layout.x &&
          current.y === layout.y
        ) {
          return state
        }

        return {
          panelLayouts: {
            ...state.panelLayouts,
            [panelId]: layout,
          },
        }
      })
    },
    setPanelRect(panelId: string, rect: PanelRect | null) {
      set((state) => {
        if (rect === null) {
          if (!state.panelRects[panelId]) return state
          const panelRects = { ...state.panelRects }
          delete panelRects[panelId]
          return { panelRects }
        }

        const current = state.panelRects[panelId]
        if (
          current?.bottom === rect.bottom &&
          current.height === rect.height &&
          current.left === rect.left &&
          current.right === rect.right &&
          current.top === rect.top &&
          current.width === rect.width
        ) {
          return state
        }

        return {
          panelRects: {
            ...state.panelRects,
            [panelId]: rect,
          },
        }
      })
    },
    unregisterPanel(panelId: string) {
      set((state) => {
        if (!state.panels[panelId]) return state

        const panels = { ...state.panels }
        const panelRects = { ...state.panelRects }
        delete panels[panelId]
        delete panelRects[panelId]
        return {
          panelOrder: state.panelOrder.filter((id) => id !== panelId),
          panelRects,
          panels,
        }
      })
    },
  })

  if (!persistLayout) {
    return createStore<TweakerState>()(createState)
  }

  return createStore<TweakerState>()(
    persist<TweakerState, [], [], TweakerPersistedState>(createState, {
      name: storageKey,
      storage: createValidatedPanelPersistStorage(),
      partialize: (state): TweakerPersistedState => ({
        panelLayouts: state.panelLayouts,
      }),
      merge: (persistedState, currentState) => {
        const parsed = tweakerPersistedStateSchema.safeParse(persistedState)
        return parsed.success ? { ...currentState, ...parsed.data } : currentState
      },
    }),
  )
}

export function panelZIndexForState(state: Pick<TweakerState, 'panelOrder'>, panelId: string) {
  const index = state.panelOrder.indexOf(panelId)
  return panelZIndexBase + (index < 0 ? 0 : index)
}

export function portalLayerZIndexForState(state: Pick<TweakerState, 'panelOrder'>, offset: number) {
  const highestPanelZIndex = panelZIndexBase + Math.max(0, state.panelOrder.length - 1)
  return highestPanelZIndex + offset
}

export function portalLayerZIndexValue(cssVariable: string, floor: number) {
  return `max(var(${cssVariable}), ${floor})`
}

export function modalZIndexForState(state: Pick<TweakerState, 'panelOrder'>) {
  return portalLayerZIndexForState(state, 4)
}

export function useRegisterTweakerPanel({ id }: TweakerPanelRegistration) {
  const store = useTweakerStoreApi()

  useEffect(() => {
    store.getState().registerPanel({ id })

    return () => {
      store.getState().unregisterPanel(id)
    }
  }, [id, store])
}

export function TweakerProvider({
  children,
  persistLayout = true,
  portalContainer: portalContainerProp,
  storageKey = panelLayoutStorageKey,
  theme: themePreference = tweakerDefaultTheme,
}: TweakerProviderProps) {
  const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null)
  const storeRef = useRef<TweakerStore | null>(null)
  const theme = useResolvedTweakerTheme(themePreference)

  if (!storeRef.current) {
    storeRef.current = createTweakerStore({ persistLayout, storageKey })
  }
  const store = storeRef.current
  const portalContainer = portalContainerProp ?? containerElement

  const handleContainerRef = useCallback((element: HTMLDivElement | null) => {
    setContainerElement(element)
  }, [])

  const contextValue = useMemo<TweakerProviderContextValue>(
    () => ({
      containerElement,
      portalContainer,
      store,
      theme,
    }),
    [containerElement, portalContainer, store, theme],
  )

  return (
    <TweakerContext.Provider value={contextValue}>
      {children}
      <div
        data-tweaker-container
        data-tweaker-theme={theme}
        ref={handleContainerRef}
        className="pointer-events-none fixed inset-0 h-dvh w-dvw"
      ></div>
    </TweakerContext.Provider>
  )
}

export function useTweakerProviderContext() {
  const context = useContext(TweakerContext)
  if (!context) {
    throw new Error('Tweaker components must be rendered inside TweakerProvider.')
  }
  return context
}

export function useTweakerStoreApi() {
  return useTweakerProviderContext().store
}

export function useTweakerSelector<T>(selector: (state: TweakerState) => T) {
  return useStore(useTweakerStoreApi(), selector)
}

function useResolvedTweakerTheme(theme: TweakerTheme): TweakerResolvedTheme {
  const [systemTheme, setSystemTheme] = useState<TweakerResolvedTheme>(() => preferredSystemTheme())

  useEffect(() => {
    if (
      theme !== 'system' ||
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return
    }

    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const updateTheme = () => setSystemTheme(query.matches ? 'dark' : 'light')
    updateTheme()
    query.addEventListener('change', updateTheme)
    return () => query.removeEventListener('change', updateTheme)
  }, [theme])

  return theme === 'system' ? systemTheme : theme
}

function preferredSystemTheme(): TweakerResolvedTheme {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark'
}
