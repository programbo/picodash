import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { isSortableOperation } from "@dnd-kit/react/sortable";
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { normalizePanelAppearance, normalizePanelId } from "../control.js";
import { useTweakerSelector } from "../react/context.js";
import type { DockState, PanelAppearance, Placement } from "../types.js";
import { moveItem, orderControls } from "./order.js";
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

export function TweakerPanel({
  id,
  className = "",
  defaultPlacement,
  placement,
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
  const setSectionOrder = useTweakerSelector((state) => state.setSectionOrder);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origin: PanelPosition;
  } | null>(null);
  const viewportSize = useViewportSize();
  const [freePosition, setFreePosition] = useState<PanelPosition | null>(null);

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

  function handlePanelPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const element = panelRef.current;
    if (!element) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = element.getBoundingClientRect();
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      origin: {
        x: rect.left,
        y: rect.top,
      },
    };
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
    event.currentTarget.releasePointerCapture(event.pointerId);
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

  function handleDragEnd(event: DragEndEvent) {
    if (!isSortableOperation(event.operation)) return;
    const source = event.operation.source;
    const target = event.operation.target;
    if (!source || !target || source.group !== target.group) return;

    const sectionId = String(source.data.sectionId);
    const sectionControls = orderControls(controls, sectionId, order);
    const ids = sectionControls.map((control) => control.persistId);
    const from = ids.indexOf(String(source.id));
    const to = ids.indexOf(String(target.id));
    if (from < 0 || to < 0 || from === to) return;
    setSectionOrder(panelId, sectionId, moveItem(ids, from, to));
  }

  const style = freePosition || !dock ? positionToStyle(position) : dockToStyle(dock);
  applyAppearance(style, { ...legacyAppearance, ...appearance });

  return (
    <aside
      ref={panelRef}
      className={`tw-panel ${collapsed ? "is-collapsed" : ""} ${className}`}
      style={style}
      data-panel-id={panelId}
      data-testid={panelId === "default" ? "tweaker-panel" : `tweaker-panel-${panelId}`}
    >
      <div
        className="tw-panel__header"
        onPointerDown={handlePanelPointerDown}
        onPointerMove={handlePanelPointerMove}
        onPointerUp={handlePanelPointerUp}
      >
        <button
          className="tw-icon-button"
          type="button"
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setCollapsed(panelId, !collapsed)}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
        </button>
        <strong>{title}</strong>
        <button
          className="tw-icon-button"
          type="button"
          aria-label={`Reset ${title} values`}
          title={`Reset ${title} values`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => resetValues(panelId)}
        >
          <RotateCcw size={14} />
        </button>
        <button
          className="tw-text-button"
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => resetOrder(panelId)}
        >
          Order
        </button>
      </div>

      {!collapsed && (
        <DragDropProvider onDragEnd={handleDragEnd}>
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
