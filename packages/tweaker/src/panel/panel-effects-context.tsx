import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { PanelTheme } from "../types.js";

export type PanelEffectStyle = CSSProperties &
  Partial<
    Record<
      | "--tw-panel-color-opacity"
      | "--tw-panel-hover-color-opacity"
      | "--tw-panel-background-blur"
      | "--tw-panel-hover-background-blur",
      string
    >
  >;

interface PanelEffectContextValue {
  style: PanelEffectStyle;
  theme: PanelTheme;
  setInteractionActive: (id: string, active: boolean) => void;
}

const PanelEffectContext = createContext<PanelEffectContextValue>({
  style: {},
  theme: "dark",
  setInteractionActive: () => {},
});

export function PanelEffectProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: PanelEffectContextValue;
}) {
  return <PanelEffectContext.Provider value={value}>{children}</PanelEffectContext.Provider>;
}

export function usePanelEffects() {
  return useContext(PanelEffectContext);
}

export function usePanelInteraction(id: string) {
  const { setInteractionActive } = usePanelEffects();

  useEffect(() => {
    return () => setInteractionActive(id, false);
  }, [id, setInteractionActive]);

  return useCallback(
    (active: boolean) => setInteractionActive(id, active),
    [id, setInteractionActive],
  );
}
