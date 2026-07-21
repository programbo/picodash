import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
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
import {
  dockForSnapPosition,
  placementForPanelLayout,
  positionForFloatingCorner,
  rectForPanelBoundary,
  type PanelLayout,
  type PanelRect,
} from './panel-snapping.js'
import { tweakerDefaultTheme, tweakerLayerTokens } from './theme.js'
import { TweakerThemeContextProvider } from './tweaker-theme-context.js'
import type {
  TweakerPanelBoundary,
  TweakerPanelDefaultPlacement,
  TweakerPanelPlacement,
} from './tweaker-panel-types.js'

export interface TweakerPanelRegistration {
  boundary: Element | null
  id: string
  placement: TweakerPanelPlacement
  visible: boolean
}

export interface TweakerPanelRegistrationInput {
  boundary?: Element | null
  defaultPlacement?: TweakerPanelDefaultPlacement
  id: string
  visible?: boolean
}

export interface TweakerPanelController {
  placement: TweakerPanelPlacement
  visible: boolean
  activate: () => void
  hide: () => void
  setPlacement: (placement: TweakerPanelPlacement) => void
  setVisible: (visible: boolean) => void
  show: () => void
  toggle: () => void
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
  registerPanel: (panel: TweakerPanelRegistrationInput) => void
  setPanelBoundary: (panelId: string, boundary: Element | null) => void
  setPanelLayout: (panelId: string, layout: PanelLayout) => void
  setPanelPlacement: (panelId: string, placement: TweakerPanelPlacement) => void
  setPanelRect: (panelId: string, rect: PanelRect | null) => void
  setPanelVisible: (panelId: string, visible: boolean) => void
  togglePanel: (panelId: string) => void
  unregisterPanel: (panelId: string) => void
}

export type TweakerStore = StoreApi<TweakerState>

export interface TweakerProviderContextValue {
  containerElement: HTMLDivElement | null
  panelBoundary: TweakerPanelBoundary | null
  portalContainer: HTMLElement | null
  theme: TweakerResolvedTheme
  store: TweakerStore
}

export type TweakerTheme = 'dark' | 'light' | 'system' | (string & {})
export type TweakerResolvedTheme = string

export interface TweakerProviderProps {
  children: ReactNode
  panelBoundary?: TweakerPanelBoundary | null
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
        const panel = state.panels[panelId]
        if (!panel) return state

        const previousIndex = state.panelOrder.indexOf(panelId)
        const alreadyActive = previousIndex === state.panelOrder.length - 1
        if (alreadyActive && panel.visible) return state

        return {
          panelOrder: alreadyActive
            ? state.panelOrder
            : [...state.panelOrder.filter((id) => id !== panelId), panelId],
          panels: panel.visible
            ? state.panels
            : {
                ...state.panels,
                [panelId]: { ...panel, visible: true },
              },
        }
      })
    },
    registerPanel(panel: TweakerPanelRegistrationInput) {
      set((state) => {
        const panelOrder = state.panelOrder.includes(panel.id)
          ? state.panelOrder
          : [...state.panelOrder, panel.id]
        const registration =
          state.panels[panel.id] ??
          ({
            boundary: panel.boundary ?? null,
            id: panel.id,
            placement: placementForPanelLayout(
              state.panelLayouts[panel.id],
              panel.defaultPlacement,
            ),
            visible: panel.visible ?? true,
          } satisfies TweakerPanelRegistration)

        return {
          panelOrder,
          panels: {
            ...state.panels,
            [panel.id]: registration,
          },
        }
      })
    },
    setPanelBoundary(panelId: string, boundary: Element | null) {
      set((state) => {
        const panel = state.panels[panelId]
        if (!panel || panel.boundary === boundary) return state

        const panelRects = { ...state.panelRects }
        delete panelRects[panelId]
        return {
          panelRects,
          panels: {
            ...state.panels,
            [panelId]: { ...panel, boundary },
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
          placementsEqual(current?.placement, layout.placement) &&
          current?.x === layout.x &&
          current.y === layout.y
        ) {
          return state
        }

        const panel = state.panels[panelId]
        const placement = layout.placement
          ? layout.placement
          : layout.dock
            ? placementForPanelLayout(layout)
            : ({ mode: 'floating' } satisfies TweakerPanelPlacement)
        return {
          panelLayouts: {
            ...state.panelLayouts,
            [panelId]: layout,
          },
          panels: panel
            ? {
                ...state.panels,
                [panelId]: placementsEqual(panel.placement, placement)
                  ? panel
                  : { ...panel, placement },
              }
            : state.panels,
        }
      })
    },
    setPanelPlacement(panelId: string, placement: TweakerPanelPlacement) {
      set((state) => {
        const panel = state.panels[panelId]
        if (!panel) return state

        const current = state.panelLayouts[panelId]
        const measuredRect = state.panelRects[panelId]
        const requestedFloatingPosition =
          placement.mode === 'floating' && placement.position && measuredRect
            ? positionForFloatingCorner(
                placement.position,
                measuredRect,
                rectForPanelBoundary(panel.boundary),
              )
            : null
        const layout: PanelLayout = {
          dock: placement.mode === 'magnetic' ? dockForSnapPosition(placement.position) : null,
          placement,
          x: requestedFloatingPosition?.x ?? current?.x ?? measuredRect?.left ?? 0,
          y: requestedFloatingPosition?.y ?? current?.y ?? measuredRect?.top ?? 0,
        }
        return {
          panelLayouts: {
            ...state.panelLayouts,
            [panelId]: layout,
          },
          panels: placementsEqual(panel.placement, placement)
            ? state.panels
            : {
                ...state.panels,
                [panelId]: { ...panel, placement },
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
    setPanelVisible(panelId: string, visible: boolean) {
      set((state) => {
        const panel = state.panels[panelId]
        if (!panel || panel.visible === visible) return state

        return {
          panels: {
            ...state.panels,
            [panelId]: { ...panel, visible },
          },
        }
      })
    },
    togglePanel(panelId: string) {
      set((state) => {
        const panel = state.panels[panelId]
        if (!panel) return state

        return {
          panels: {
            ...state.panels,
            [panelId]: { ...panel, visible: !panel.visible },
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

export function useRegisterTweakerPanel({
  boundary,
  defaultPlacement,
  id,
  visible,
}: TweakerPanelRegistrationInput) {
  const store = useTweakerProviderStoreApi()
  const initialRegistrationRef = useRef({ boundary, defaultPlacement, id, visible })

  useLayoutEffect(() => {
    store.getState().registerPanel(initialRegistrationRef.current)

    return () => {
      store.getState().unregisterPanel(id)
    }
  }, [id, store])

  useLayoutEffect(() => {
    store.getState().setPanelBoundary(id, boundary ?? null)
  }, [boundary, id, store])
}

export function TweakerProvider({
  children,
  panelBoundary = null,
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
      panelBoundary,
      portalContainer,
      store,
      theme,
    }),
    [containerElement, panelBoundary, portalContainer, store, theme],
  )

  return (
    <TweakerThemeContextProvider theme={theme}>
      <TweakerContext.Provider value={contextValue}>
        <div data-tweaker-provider-content="" data-tweaker-theme={theme} className="contents">
          {children}
        </div>
        <div
          data-tweaker-container
          data-tweaker-theme={theme}
          ref={handleContainerRef}
          className="pointer-events-none fixed inset-0 h-dvh w-dvw"
        ></div>
      </TweakerContext.Provider>
    </TweakerThemeContextProvider>
  )
}

export function useTweakerProviderContext() {
  const context = useContext(TweakerContext)
  if (!context) {
    throw new Error('Tweaker components must be rendered inside TweakerProvider.')
  }
  return context
}

export function useTweakerProviderStoreApi() {
  return useTweakerProviderContext().store
}

export function useTweakerProviderSelector<T>(selector: (state: TweakerState) => T) {
  return useStore(useTweakerProviderStoreApi(), selector)
}

export function useTweakerPanel(panelId: string): TweakerPanelController | null {
  const store = useTweakerProviderStoreApi()
  const panel = useStore(store, (state) => state.panels[panelId])

  return useMemo(() => {
    if (!panel) return null

    return {
      placement: panel.placement,
      visible: panel.visible,
      activate: () => store.getState().activatePanel(panelId),
      hide: () => store.getState().setPanelVisible(panelId, false),
      setPlacement: (placement: TweakerPanelPlacement) =>
        store.getState().setPanelPlacement(panelId, placement),
      setVisible: (visible: boolean) => store.getState().setPanelVisible(panelId, visible),
      show: () => store.getState().setPanelVisible(panelId, true),
      toggle: () => store.getState().togglePanel(panelId),
    }
  }, [panel, panelId, store])
}

function placementsEqual(
  left: TweakerPanelPlacement | undefined,
  right: TweakerPanelPlacement | undefined,
) {
  return left?.mode === right?.mode && left?.position === right?.position
}

function useResolvedTweakerTheme(theme: TweakerTheme): TweakerResolvedTheme {
  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>(() => preferredSystemTheme())

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

function preferredSystemTheme(): 'dark' | 'light' {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark'
}
