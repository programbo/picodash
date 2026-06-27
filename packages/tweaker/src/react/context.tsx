import { createContext, useContext, useRef } from "react";
import { useStore } from "zustand";
import { createTweakerStore } from "../store/create-tweaker-store.js";
import {
  defaultPanelId,
  type TweakerCustomControlComponent,
  type TweakerProviderProps,
  type TweakerSnapshot,
  type TweakerState,
  type TweakerStore,
} from "../types.js";

interface TweakerContextValue {
  store: TweakerStore;
  controls: Record<string, TweakerCustomControlComponent>;
}

const TweakerContext = createContext<TweakerContextValue | null>(null);

export function TweakerProvider({
  children,
  id,
  storeId,
  persistence,
  controls = {},
}: TweakerProviderProps) {
  const storeRef = useRef<TweakerStore | null>(null);
  const resolvedId = id ?? storeId ?? defaultPanelId;

  if (!storeRef.current) {
    storeRef.current = createTweakerStore({ id: resolvedId, storeId, persistence });
  }

  return (
    <TweakerContext.Provider value={{ store: storeRef.current, controls }}>
      {children}
    </TweakerContext.Provider>
  );
}

function useTweakerContext() {
  const context = useContext(TweakerContext);
  if (!context) {
    throw new Error("Tweaker components must be rendered inside TweakerProvider.");
  }
  return context;
}

export function useTweakerStoreApi() {
  return useTweakerContext().store;
}

export function useTweakerCustomControls() {
  return useTweakerContext().controls;
}

export function useTweakerStore() {
  return useStore(useTweakerStoreApi());
}

export function useTweakerSelector<T>(selector: (state: TweakerState) => T) {
  return useStore(useTweakerStoreApi(), selector);
}

export function useTweakerSnapshot() {
  return useStore(useTweakerStoreApi()) as TweakerSnapshot;
}
