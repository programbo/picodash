import { createContext, useContext, type CSSProperties, type ReactNode } from "react";

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

const PanelEffectContext = createContext<PanelEffectStyle>({});

export function PanelEffectProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: PanelEffectStyle;
}) {
  return <PanelEffectContext.Provider value={value}>{children}</PanelEffectContext.Provider>;
}

export function usePanelEffectStyle() {
  return useContext(PanelEffectContext);
}
