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
import { useTweakerSnapshot, useTweakerStore } from "../react/context.js";
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
  const store = useTweakerStore();
  const snapshot = useTweakerSnapshot();
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
    if (snapshot.dock) {
      return clampPosition(
        dockToPosition(snapshot.dock, window.innerWidth, window.innerHeight),
        panelRef.current,
      );
    }
    return placementToPosition(placement, window.innerWidth, window.innerHeight);
  }, [freePosition, placement, snapshot.dock]);

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

    const dock = nearestDock(position, element);
    store.setDock(dock);
    if (dock) {
      setFreePosition(null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!isSortableOperation(event.operation)) return;
    const source = event.operation.source;
    const target = event.operation.target;
    if (!source || !target || source.group !== target.group) return;

    const section = String(source.group);
    const controls = orderControls(snapshot.controls, section, snapshot.order);
    const ids = controls.map((control) => control.id);
    const from = ids.indexOf(String(source.id));
    const to = ids.indexOf(String(target.id));
    if (from < 0 || to < 0 || from === to) return;
    store.setSectionOrder(section, moveItem(ids, from, to));
  }

  const style = {
    "--tweaker-x": `${position.x}px`,
    "--tweaker-y": `${position.y}px`,
  } as CSSProperties;

  return (
    <aside
      ref={panelRef}
      className={`tw-panel ${snapshot.collapsed ? "is-collapsed" : ""} ${className}`}
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
          aria-label={snapshot.collapsed ? "Expand panel" : "Collapse panel"}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => store.setCollapsed(!snapshot.collapsed)}
        >
          {snapshot.collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
        </button>
        <strong>{title}</strong>
        <button
          className="tw-icon-button"
          type="button"
          aria-label="Reset values"
          title="Reset values"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => store.resetValues()}
        >
          <RotateCcw size={14} />
        </button>
        <button
          className="tw-text-button"
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => store.resetOrder()}
        >
          Order
        </button>
      </div>

      {!snapshot.collapsed && (
        <DragDropProvider onDragEnd={handleDragEnd}>
          <div className="tw-panel__body">
            {snapshot.sectionOrder.map((section) => (
              <TweakerSection
                key={section}
                section={section}
                controls={orderControls(snapshot.controls, section, snapshot.order)}
              />
            ))}
          </div>
        </DragDropProvider>
      )}
    </aside>
  );
}
