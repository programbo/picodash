import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useStore } from 'zustand'
import type { PicodashItemRegistration, PicodashStore, PicodashStoreState } from '@picodash/store'
import type { AnyPicodashStore, AnyPicodashValues } from './picodash-panel-types.js'

const PicodashPanelContext = createContext<AnyPicodashStore | null>(null)

export function PicodashPanelContextProvider<TValues extends object>({
  children,
  store,
}: {
  children: ReactNode
  store: PicodashStore<TValues>
}) {
  return (
    <PicodashPanelContext.Provider value={store as unknown as AnyPicodashStore}>
      {children}
    </PicodashPanelContext.Provider>
  )
}

export function usePicodashPanelStoreApi() {
  const store = useContext(PicodashPanelContext)
  if (!store) throw new Error('Picodash panel content must be rendered inside PicodashPanel.')
  return store
}

export function usePicodashPanelSelector<T>(
  selector: (state: PicodashStoreState<AnyPicodashValues>) => T,
) {
  return useStore(usePicodashPanelStoreApi(), selector)
}

export function useRegisterPicodashItem(item: PicodashItemRegistration<AnyPicodashValues>) {
  const {
    collapsible,
    defaultCollapsed,
    field,
    fields,
    hidden,
    id,
    kind,
    label,
    parentId,
    pin,
    reorderable,
  } = item
  const store = usePicodashPanelStoreApi()

  useEffect(() => {
    const result = store.getState().registerItem(item)
    if (!result.success) {
      throw new Error(result.errors.map((error) => error.message).join(' '))
    }
  }, [
    collapsible,
    defaultCollapsed,
    field,
    fields,
    hidden,
    id,
    kind,
    label,
    parentId,
    pin,
    reorderable,
    store,
  ])

  useEffect(() => {
    return () => store.getState().unregisterItem(id)
  }, [id, store])
}
