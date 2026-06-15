import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";

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

const PanelEffectContext = createContext<PanelEffectStyle>({});
const PanelActivityContext = createContext<(active: boolean) => void>(() => {});
const noopPanelActivity = () => {};

export function PanelEffectProvider({
  children,
  onOverlayActiveChange,
  value,
}: {
  children: ReactNode;
  onOverlayActiveChange?: (active: boolean) => void;
  value: PanelEffectStyle;
}) {
  return (
    <PanelEffectContext.Provider value={value}>
      <PanelActivityContext.Provider value={onOverlayActiveChange ?? noopPanelActivity}>
        {children}
      </PanelActivityContext.Provider>
    </PanelEffectContext.Provider>
  );
}

export function usePanelEffectStyle() {
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
