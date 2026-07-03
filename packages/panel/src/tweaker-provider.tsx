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
import { createStore, useStore, type StoreApi } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  createValidatedPanelPersistStorage,
  emptyTweakerPersistedState,
  panelLayoutStorageKey,
  tweakerPersistedStateSchema,
} from './panel-persistence.js'
import type { PanelLayout, PanelRect } from './panel-snapping.js'

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
  store: TweakerStore
}

export interface TweakerProviderProps {
  children: ReactNode
}

const TweakerContext = createContext<TweakerProviderContextValue | null>(null)
const panelZIndexBase = 1000

export function createTweakerStore(): TweakerStore {
  return createStore<TweakerState>()(
    persist(
      (set) => ({
        ...emptyTweakerPersistedState(),
        panelOrder: [],
        panelRects: {},
        panels: {},
        activatePanel(panelId) {
          set((state) => {
            if (!state.panels[panelId]) return state

            const previousIndex = state.panelOrder.indexOf(panelId)
            if (previousIndex === state.panelOrder.length - 1) return state

            return {
              panelOrder: [...state.panelOrder.filter((id) => id !== panelId), panelId],
            }
          })
        },
        registerPanel(panel) {
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
        setPanelLayout(panelId, layout) {
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
        setPanelRect(panelId, rect) {
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
        unregisterPanel(panelId) {
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
      }),
      {
        name: panelLayoutStorageKey,
        storage: createValidatedPanelPersistStorage(),
        partialize: (state): TweakerPersistedState => ({
          panelLayouts: state.panelLayouts,
        }),
        merge: (persistedState, currentState) => {
          const parsed = tweakerPersistedStateSchema.safeParse(persistedState)
          return parsed.success ? { ...currentState, ...parsed.data } : currentState
        },
      },
    ),
  )
}

export function panelZIndexForState(state: Pick<TweakerState, 'panelOrder'>, panelId: string) {
  const index = state.panelOrder.indexOf(panelId)
  return panelZIndexBase + (index < 0 ? 0 : index)
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

export function TweakerProvider({ children }: TweakerProviderProps) {
  const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null)
  const storeRef = useRef<TweakerStore | null>(null)

  if (!storeRef.current) {
    storeRef.current = createTweakerStore()
  }
  const store = storeRef.current

  const handleContainerRef = useCallback((element: HTMLDivElement | null) => {
    setContainerElement(element)
  }, [])

  const contextValue = useMemo<TweakerProviderContextValue>(
    () => ({
      containerElement,
      store,
    }),
    [containerElement, store],
  )

  return (
    <TweakerContext.Provider value={contextValue}>
      {children}
      <div
        data-tweaker-container
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
