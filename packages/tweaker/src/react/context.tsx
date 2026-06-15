import { createContext, useContext, useRef } from "react";
import { useStore } from "zustand";
import { createTweakerStore } from "../store/create-tweaker-store.js";
import type { TweakerProviderProps, TweakerSnapshot, TweakerStore } from "../types.js";

const TweakerContext = createContext<TweakerStore | null>(null);

export function TweakerProvider({ children, storeId, stale = "ignore" }: TweakerProviderProps) {
  const storeRef = useRef<TweakerStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createTweakerStore({ storeId, stale });
  }

  return <TweakerContext.Provider value={storeRef.current}>{children}</TweakerContext.Provider>;
}

export function useTweakerStoreApi() {
  const store = useContext(TweakerContext);
  if (!store) {
    throw new Error("Tweaker components must be rendered inside TweakerProvider.");
  }
  return store;
}

export function useTweakerStore() {
  return useStore(useTweakerStoreApi());
}

export function useTweakerSnapshot() {
  return useStore(useTweakerStoreApi()) as TweakerSnapshot;
}
