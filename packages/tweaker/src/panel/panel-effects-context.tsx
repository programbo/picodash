import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
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
}

const PanelEffectContext = createContext<PanelEffectContextValue>({
  style: {},
  theme: "dark",
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
