import { DragDropProvider, type DragEndEvent, type DragStartEvent } from "@dnd-kit/react";
import { clsx } from "clsx";
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "react-aria-components";
import { normalizePanelAppearance, normalizePanelId } from "../control.js";
import { useTweakerSelector } from "../react/context.js";
import type { DockState, PanelAppearance, PanelTheme, Placement } from "../types.js";
import { orderControls } from "./order.js";
import { PanelEffectProvider, type PanelEffectStyle } from "./panel-effects-context.js";
import {
  clampPosition,
  dockToPosition,
  nearestDock,
  type PanelPosition,
  placementToPosition,
} from "./position.js";
import { TweakerSection } from "./tweaker-section.js";

const emptyOrder: Record<string, string[]> = {};
const emptySectionOrder: string[] = [];

export interface TweakerPanelProps {
  id?: string;
  className?: string;
  defaultPlacement?: Placement;
  placement?: Placement;
  theme?: PanelTheme;
  title?: string;
  appearance?: PanelAppearance;
}

type PanelStyle = CSSProperties &
  Partial<
    Record<
      | "--tw-panel-color-opacity"
      | "--tw-panel-hover-color-opacity"
      | "--tw-panel-background-blur"
      | "--tw-panel-hover-background-blur",
      string
    >
  >;

function applyAppearance(style: PanelStyle, appearance: PanelAppearance) {
  const normalized = normalizePanelAppearance(appearance);
  if (normalized.surfaceOpacity !== undefined) {
    style["--tw-panel-color-opacity"] = String(normalized.surfaceOpacity);
  }
  if (normalized.activeSurfaceOpacity !== undefined) {
    style["--tw-panel-hover-color-opacity"] = String(normalized.activeSurfaceOpacity);
  }
  if (normalized.backdropBlur !== undefined) {
    style["--tw-panel-background-blur"] = `${normalized.backdropBlur}px`;
  }
  if (normalized.activeBackdropBlur !== undefined) {
    style["--tw-panel-hover-background-blur"] = `${normalized.activeBackdropBlur}px`;
  }
}

function trySetPointerCapture(element: Element, pointerId: number) {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    return;
  }
}

function tryReleasePointerCapture(element: Element, pointerId: number) {
  try {
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
  } catch {
    return;
  }
}

export function TweakerPanel({
  id,
  className,
  defaultPlacement,
  placement,
  theme = "dark",
  title = "Tweaker",
  appearance,
}: TweakerPanelProps) {
  const panelId = normalizePanelId(id);
  const resolvedPlacement = defaultPlacement ?? placement ?? "top-right";
  const allControls = useTweakerSelector((state) => state.controls);
  const controls = useMemo(
    () => allControls.filter((control) => control.panelId === panelId),
    [allControls, panelId],
  );
  const dock = useTweakerSelector((state) => state.panels[panelId]?.dock ?? null);
  const collapsed = useTweakerSelector((state) => state.panels[panelId]?.collapsed ?? false);
  const order = useTweakerSelector((state) => state.order[panelId] ?? emptyOrder);
  const sectionOrder = useTweakerSelector(
    (state) => state.sectionOrder[panelId] ?? emptySectionOrder,
  );
  const legacyAppearance = useTweakerSelector((state) => state.panelAppearances[panelId]);
  const resetOrder = useTweakerSelector((state) => state.resetOrder);
  const resetValues = useTweakerSelector((state) => state.resetValues);
  const setCollapsed = useTweakerSelector((state) => state.setPanelCollapsed);
  const setDock = useTweakerSelector((state) => state.setPanelDock);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origin: PanelPosition;
  } | null>(null);
  const rowDragInteractionIdRef = useRef<string | null>(null);
  const rowDragInteractionTokenRef = useRef(0);
  const rowDragSettleTimeoutRef = useRef<number | null>(null);
  const viewportSize = useViewportSize();
  const [freePosition, setFreePosition] = useState<PanelPosition | null>(null);
  const [activeInteractionIds, setActiveInteractionIds] = useState<Set<string>>(() => new Set());
  const setInteractionActive = useCallback((interactionId: string, active: boolean) => {
    setActiveInteractionIds((ids) => {
      if (ids.has(interactionId) === active) return ids;

      const next = new Set(ids);
      if (active) {
        next.add(interactionId);
      } else {
        next.delete(interactionId);
      }
      return next;
    });
  }, []);

  const position = useMemo(() => {
    if (typeof window === "undefined") return { x: 16, y: 16 };
    if (freePosition) return clampPosition(freePosition, panelRef.current);
    if (dock) {
      return clampPosition(
        dockToPosition(dock, window.innerWidth, window.innerHeight),
        panelRef.current,
      );
    }
    return clampPosition(
      placementToPosition(resolvedPlacement, viewportSize.width, viewportSize.height),
      panelRef.current,
    );
  }, [dock, freePosition, resolvedPlacement, viewportSize]);

  useEffect(() => {
    return () => {
      if (rowDragSettleTimeoutRef.current !== null) {
        window.clearTimeout(rowDragSettleTimeoutRef.current);
      }
    };
  }, []);

  function handlePanelPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const element = panelRef.current;
    if (!element) return;
    trySetPointerCapture(event.currentTarget, event.pointerId);
    const rect = element.getBoundingClientRect();
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      origin: {
        x: rect.left,
        y: rect.top,
      },
    };
    setInteractionActive("panel-drag", true);
  }

  function handlePanelPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const next = clampPosition(
      {
        x: drag.origin.x + event.clientX - drag.startX,
        y: drag.origin.y + event.clientY - drag.startY,
      },
      panelRef.current,
    );
    setFreePosition(next);
  }

  function handlePanelPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const element = panelRef.current;
    dragRef.current = null;
    setInteractionActive("panel-drag", false);
    tryReleasePointerCapture(event.currentTarget, event.pointerId);
    if (!drag || !element) return;

    const nextPosition = clampPosition(
      {
        x: drag.origin.x + event.clientX - drag.startX,
        y: drag.origin.y + event.clientY - drag.startY,
      },
      element,
    );
    const nextDock = nearestDock(nextPosition, element);
    setDock(panelId, nextDock);
    if (nextDock) {
      setFreePosition(null);
    } else {
      setFreePosition(nextPosition);
    }
  }

  function handlePanelPointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    setInteractionActive("panel-drag", false);
    tryReleasePointerCapture(event.currentTarget, event.pointerId);
  }

  function handlePanelLostPointerCapture() {
    if (!dragRef.current) return;
    dragRef.current = null;
    setInteractionActive("panel-drag", false);
  }

  function clearRowDragInteraction() {
    if (rowDragSettleTimeoutRef.current !== null) {
      window.clearTimeout(rowDragSettleTimeoutRef.current);
      rowDragSettleTimeoutRef.current = null;
    }
    const interactionId = rowDragInteractionIdRef.current;
    if (!interactionId) return;
    rowDragInteractionIdRef.current = null;
    setInteractionActive(interactionId, false);
  }

  function settleRowDragInteraction() {
    const token = rowDragInteractionTokenRef.current;
    if (rowDragSettleTimeoutRef.current !== null) {
      window.clearTimeout(rowDragSettleTimeoutRef.current);
    }
    rowDragSettleTimeoutRef.current = window.setTimeout(() => {
      if (rowDragInteractionTokenRef.current === token) {
        clearRowDragInteraction();
      }
    }, 180);
  }

  function handleDragStart(event: DragStartEvent) {
    const source = event.operation.source;
    if (!source || source.data.panelId !== panelId) return;

    if (rowDragSettleTimeoutRef.current !== null) {
      window.clearTimeout(rowDragSettleTimeoutRef.current);
      rowDragSettleTimeoutRef.current = null;
    }
    rowDragInteractionTokenRef.current += 1;
    const interactionId = `dnd:${String(source.id)}`;
    rowDragInteractionIdRef.current = interactionId;
    setInteractionActive(interactionId, true);
  }

  function handleDragEnd(event: DragEndEvent) {
    const source = event.operation.source;
    if (!source || source.data.panelId !== panelId) {
      clearRowDragInteraction();
      return;
    }
    settleRowDragInteraction();
  }

  const effectStyle: PanelEffectStyle = {};
  const style = freePosition || !dock ? positionToStyle(position) : dockToStyle(dock);
  const resolvedAppearance = { ...legacyAppearance, ...appearance };
  applyAppearance(style, resolvedAppearance);
  applyAppearance(effectStyle, resolvedAppearance);

  return (
    <aside
      ref={panelRef}
      className={clsx("tw-panel", collapsed && "is-collapsed", className)}
      style={style}
      data-active={activeInteractionIds.size > 0 ? "true" : undefined}
      data-panel-id={panelId}
      data-theme={theme}
      data-testid={panelId === "default" ? "tweaker-panel" : `tweaker-panel-${panelId}`}
    >
      <div
        className="tw-panel__header"
        onPointerDown={handlePanelPointerDown}
        onPointerMove={handlePanelPointerMove}
        onPointerUp={handlePanelPointerUp}
        onPointerCancel={handlePanelPointerCancel}
        onLostPointerCapture={handlePanelLostPointerCapture}
      >
        <Button
          className="tw-icon-button"
          type="button"
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          onPointerDown={(event) => event.stopPropagation()}
          onPress={() => setCollapsed(panelId, !collapsed)}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
        </Button>
        <strong>{title}</strong>
        <Button
          className="tw-icon-button"
          type="button"
          aria-label={`Reset ${title} values`}
          onPointerDown={(event) => event.stopPropagation()}
          onPress={() => resetValues(panelId)}
        >
          <RotateCcw size={14} />
        </Button>
        <Button
          className="tw-text-button"
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onPress={() => resetOrder(panelId)}
        >
          Order
        </Button>
      </div>

      {!collapsed && (
        <DragDropProvider onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <PanelEffectProvider value={{ style: effectStyle, theme, setInteractionActive }}>
            <div className="tw-panel__body">
              {sectionOrder.map((sectionId) => {
                const sectionControls = orderControls(controls, sectionId, order);
                const sectionLabel = sectionControls[0]?.sectionLabel ?? sectionId;
                return (
                  <TweakerSection
                    key={sectionId}
                    panelId={panelId}
                    sectionId={sectionId}
                    title={sectionLabel}
                    controls={sectionControls}
                  />
                );
              })}
            </div>
          </PanelEffectProvider>
        </DragDropProvider>
      )}
    </aside>
  );
}

function useViewportSize() {
  const [viewportSize, setViewportSize] = useState(() => {
    if (typeof window === "undefined") return { width: 0, height: 0 };
    return { width: window.innerWidth, height: window.innerHeight };
  });

  useEffect(() => {
    function handleResize() {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return viewportSize;
}

function positionToStyle(position: PanelPosition): PanelStyle {
  return {
    left: `${position.x}px`,
    top: `${position.y}px`,
  };
}

function dockToStyle(dock: DockState): PanelStyle {
  const style: PanelStyle = {};
  if (dock.edge === "left") {
    style.left = 0;
    style.top = `${dock.offset}px`;
  } else if (dock.edge === "right") {
    style.right = 0;
    style.top = `${dock.offset}px`;
  } else if (dock.edge === "bottom") {
    style.left = `${dock.offset}px`;
    style.bottom = 0;
  } else {
    style.left = `${dock.offset}px`;
    style.top = 0;
  }

  if (dock.secondaryEdge === "top") {
    delete style.bottom;
    style.top = 0;
  }
  if (dock.secondaryEdge === "bottom") {
    delete style.top;
    style.bottom = 0;
  }
  if (dock.secondaryEdge === "left") {
    delete style.right;
    style.left = 0;
  }
  if (dock.secondaryEdge === "right") {
    delete style.left;
    style.right = 0;
  }

  return style;
}
