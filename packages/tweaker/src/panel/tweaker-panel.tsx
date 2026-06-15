import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { isSortableOperation } from "@dnd-kit/react/sortable";
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTweakerSelector } from "../react/context.js";
import type { Placement } from "../types.js";
import { moveItem, orderControls } from "./order.js";
import {
  clampPosition,
  dockToPosition,
  nearestDock,
  type PanelPosition,
  placementToPosition,
} from "./position.js";
import { TweakerSection } from "./tweaker-section.js";

export interface TweakerPanelProps {
  className?: string;
  placement?: Placement;
  title?: string;
}

export function TweakerPanel({
  className = "",
  placement = "top-right",
  title = "Tweaker",
}: TweakerPanelProps) {
  const collapsed = useTweakerSelector((state) => state.collapsed);
  const controls = useTweakerSelector((state) => state.controls);
  const dock = useTweakerSelector((state) => state.dock);
  const order = useTweakerSelector((state) => state.order);
  const sectionOrder = useTweakerSelector((state) => state.sectionOrder);
  const resetOrder = useTweakerSelector((state) => state.resetOrder);
  const resetValues = useTweakerSelector((state) => state.resetValues);
  const setCollapsed = useTweakerSelector((state) => state.setCollapsed);
  const setDock = useTweakerSelector((state) => state.setDock);
  const setSectionOrder = useTweakerSelector((state) => state.setSectionOrder);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origin: PanelPosition;
  } | null>(null);
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
    return placementToPosition(placement, window.innerWidth, window.innerHeight);
  }, [dock, freePosition, placement]);

  function handlePanelPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const element = panelRef.current;
    if (!element) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      origin: position,
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

    const nextDock = nearestDock(position, element);
    setDock(nextDock);
    if (nextDock) {
      setFreePosition(null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!isSortableOperation(event.operation)) return;
    const source = event.operation.source;
    const target = event.operation.target;
    if (!source || !target || source.group !== target.group) return;

    const section = String(source.group);
    const sectionControls = orderControls(controls, section, order);
    const ids = sectionControls.map((control) => control.id);
    const from = ids.indexOf(String(source.id));
    const to = ids.indexOf(String(target.id));
    if (from < 0 || to < 0 || from === to) return;
    setSectionOrder(section, moveItem(ids, from, to));
  }

  const style = {
    "--tweaker-x": `${position.x}px`,
    "--tweaker-y": `${position.y}px`,
  } as CSSProperties;

  return (
    <aside
      ref={panelRef}
      className={`tw-panel ${collapsed ? "is-collapsed" : ""} ${className}`}
      style={style}
      data-testid="tweaker-panel"
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
          aria-label={collapsed ? "Expand panel" : "Collapse panel"}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
        </button>
        <strong>{title}</strong>
        <button
          className="tw-icon-button"
          type="button"
          aria-label="Reset values"
          title="Reset values"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => resetValues()}
        >
          <RotateCcw size={14} />
        </button>
        <button
          className="tw-text-button"
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => resetOrder()}
        >
          Order
        </button>
      </div>

      {!collapsed && (
        <DragDropProvider onDragEnd={handleDragEnd}>
          <div className="tw-panel__body">
            {sectionOrder.map((section) => (
              <TweakerSection
                key={section}
                section={section}
                controls={orderControls(controls, section, order)}
              />
            ))}
          </div>
        </DragDropProvider>
      )}
    </aside>
  );
}
