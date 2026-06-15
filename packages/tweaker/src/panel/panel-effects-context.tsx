import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
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
      | "--tw-panel-hover-background-blur"
      | "--tw-tooltip-foreground",
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
const PanelActivityContext = createContext<(active: boolean) => void>(() => {});
const noopPanelActivity = () => {};

export function PanelEffectProvider({
  children,
  onOverlayActiveChange,
  value,
}: {
  children: ReactNode;
  onOverlayActiveChange?: (active: boolean) => void;
  value: PanelEffectContextValue;
}) {
  return (
    <PanelEffectContext.Provider value={value}>
      <PanelActivityContext.Provider value={onOverlayActiveChange ?? noopPanelActivity}>
        {children}
      </PanelActivityContext.Provider>
    </PanelEffectContext.Provider>
  );
}

export function usePanelEffects() {
  return useContext(PanelEffectContext);
}

export function usePanelOverlayActivity() {
  const reportActivity = useContext(PanelActivityContext);
  const activeRef = useRef(false);

  useEffect(() => {
    return () => {
      if (activeRef.current) reportActivity(false);
    };
  }, [reportActivity]);

  return useCallback(
    (active: boolean) => {
      if (activeRef.current === active) return;
      activeRef.current = active;
      reportActivity(active);
    },
    [reportActivity],
  );
}
