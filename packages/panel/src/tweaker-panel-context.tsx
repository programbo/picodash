import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useStore } from 'zustand'
import type { HTMLMotionProps } from 'motion/react'
import type {
  TweakerItemRegistration,
  TweakerPanelState,
  TweakerPanelStore,
} from './tweaker-panel-types.js'

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

type TweakerTransformTemplate = NonNullable<HTMLMotionProps<'div'>['transformTemplate']>

export function useTweakerReorderTransformTemplate(
  store: TweakerPanelStore,
  transformTemplate?: TweakerTransformTemplate,
) {
  return useMemo<TweakerTransformTemplate>(
    () => (latest, generated) => {
      const isReordering = Boolean(store.getState().interaction.draggingId)
      if (transformTemplate) return transformTemplate(latest, isReordering ? generated : '')
      return isReordering ? generated : 'none'
    },
    [store, transformTemplate],
  )
}

export function useRegisterTweakerItem({
  defaultValue,
  fieldId,
  hidden,
  id,
  kind,
  label,
  parentId,
  placement,
  reorderable,
}: TweakerItemRegistration) {
  const store = useTweakerPanelStoreApi()

  useEffect(() => {
    store.getState().registerItem({
      defaultValue,
      fieldId,
      hidden,
      id,
      kind,
      label,
      parentId,
      placement,
      reorderable,
    })
  }, [defaultValue, fieldId, hidden, id, kind, label, parentId, placement, reorderable, store])

  useEffect(() => {
    return () => store.getState().unregisterItem(id)
  }, [id, store])
}
