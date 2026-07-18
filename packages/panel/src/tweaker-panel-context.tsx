import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useStore } from 'zustand'
import type {
  TweakerItemRegistration,
  TweakerPanelState,
  TweakerPanelStore,
} from './tweaker-panel-types.js'
import { tweakerItemImportAllowedStringValues } from './tweaker-panel-types.js'

const TweakerPanelContext = createContext<TweakerPanelStore | null>(null)

export function TweakerPanelContextProvider({
  children,
  store,
}: {
  children: ReactNode
  store: TweakerPanelStore
}) {
  return <TweakerPanelContext.Provider value={store}>{children}</TweakerPanelContext.Provider>
}

export function useTweakerPanelStoreApi() {
  const store = useContext(TweakerPanelContext)
  if (!store) throw new Error('Tweaker panel content must be rendered inside TweakerPanel.')
  return store
}

export function useTweakerPanelSelector<T>(selector: (state: TweakerPanelState) => T) {
  return useStore(useTweakerPanelStoreApi(), selector)
}

export function useTweakerPanelState() {
  return useTweakerPanelSelector((state) => state)
}

export function useRegisterTweakerItem(item: TweakerItemRegistration) {
  const {
    collapsible,
    defaultCollapsed,
    defaultValue,
    displayOnly,
    fieldId,
    hidden,
    id,
    kind,
    label,
    parentId,
    placement,
    reorderable,
  } = item
  const importAllowedStringValues = item[tweakerItemImportAllowedStringValues]
  const store = useTweakerPanelStoreApi()

  useEffect(() => {
    store.getState().registerItem({
      [tweakerItemImportAllowedStringValues]: importAllowedStringValues,
      collapsible,
      defaultCollapsed,
      defaultValue,
      displayOnly,
      fieldId,
      hidden,
      id,
      kind,
      label,
      parentId,
      placement,
      reorderable,
    })
  }, [
    collapsible,
    defaultCollapsed,
    defaultValue,
    displayOnly,
    fieldId,
    hidden,
    id,
    importAllowedStringValues,
    kind,
    label,
    parentId,
    placement,
    reorderable,
    store,
  ])

  useEffect(() => {
    return () => store.getState().unregisterItem(id)
  }, [id, store])
}
