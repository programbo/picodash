import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { RestrictToElement } from "@dnd-kit/dom/modifiers";
import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { isSortableOperation, useSortable } from "@dnd-kit/react/sortable";
import { ChevronDown, ChevronRight, GripVertical, RotateCcw } from "lucide-react";
import {
  type CSSProperties,
  type PointerEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type DockState,
  type NormalizedControl,
  type Placement,
  type PrimitiveValue,
  useTweakerSnapshot,
  useTweakerStore,
} from "./store.js";

export interface TweakerPanelProps {
  className?: string;
  placement?: Placement;
  title?: string;
}

interface PanelPosition {
  x: number;
  y: number;
}

const edgeThreshold = 24;
const panelWidth = 320;

function placementToPosition(placement: Placement, width: number, height: number) {
  const margin = 16;
  const right = Math.max(margin, width - panelWidth - margin);
  const bottom = Math.max(margin, height - 420);

  switch (placement) {
    case "top-left":
      return { x: margin, y: margin };
    case "bottom-left":
      return { x: margin, y: bottom };
    case "bottom-right":
      return { x: right, y: bottom };
    case "top-right":
    default:
      return { x: right, y: margin };
  }
}

function dockToPosition(dock: DockState, width: number, height: number) {
  const maxX = Math.max(0, width - panelWidth);
  const maxY = Math.max(0, height - 120);

  switch (dock.edge) {
    case "top":
      return { x: Math.min(Math.max(0, dock.offset), maxX), y: 0 };
    case "bottom":
      return { x: Math.min(Math.max(0, dock.offset), maxX), y: maxY };
    case "left":
      return { x: 0, y: Math.min(Math.max(0, dock.offset), maxY) };
    case "right":
      return { x: maxX, y: Math.min(Math.max(0, dock.offset), maxY) };
    default:
      return { x: 0, y: 0 };
  }
}

function clampPosition(position: PanelPosition, element: HTMLElement | null) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const rect = element?.getBoundingClientRect();
  const maxX = Math.max(0, width - (rect?.width ?? panelWidth));
  const maxY = Math.max(0, height - (rect?.height ?? 120));

  return {
    x: Math.min(Math.max(0, position.x), maxX),
    y: Math.min(Math.max(0, position.y), maxY),
  };
}

function nearestDock(position: PanelPosition, element: HTMLElement): DockState | null {
  const rect = element.getBoundingClientRect();
  const distances = [
    { edge: "top" as const, distance: position.y, offset: position.x },
    {
      edge: "right" as const,
      distance: window.innerWidth - (position.x + rect.width),
      offset: position.y,
    },
    {
      edge: "bottom" as const,
      distance: window.innerHeight - (position.y + rect.height),
      offset: position.x,
    },
    { edge: "left" as const, distance: position.x, offset: position.y },
  ].sort((a, b) => a.distance - b.distance);

  const nearest = distances[0];
  if (!nearest || nearest.distance > edgeThreshold) return null;
  return { edge: nearest.edge, offset: Math.max(0, nearest.offset) };
}

function orderControls(
  controls: NormalizedControl[],
  section: string,
  order: Record<string, string[]>,
) {
  const sectionControls = controls.filter((control) => control.section === section);
  const persisted = order[section] ?? [];
  const byId = new Map(sectionControls.map((control) => [control.id, control]));
  const ordered = persisted
    .map((id) => byId.get(id))
    .filter((control): control is NormalizedControl => Boolean(control));
  const missing = sectionControls.filter((control) => !persisted.includes(control.id));
  return [...ordered, ...missing];
}

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item) next.splice(to, 0, item);
  return next;
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

function TweakerSection({ section, controls }: { section: string; controls: NormalizedControl[] }) {
  const store = useTweakerStore();
  const listRef = useRef<HTMLDivElement | null>(null);

  function moveControl(id: string, direction: -1 | 1) {
    if (!controls.find((control) => control.id === id)?.sortable) return;
    const ids = controls.map((control) => control.id);
    const from = ids.indexOf(id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= ids.length) return;
    store.setSectionOrder(section, moveItem(ids, from, to));
  }

  function moveControlToPointer(id: string, clientY: number) {
    if (!controls.find((control) => control.id === id)?.sortable) return;
    const list = listRef.current;
    if (!list) return;

    const rows = Array.from(list.querySelectorAll<HTMLElement>("[data-control-id]"));
    const ids = controls.map((control) => control.id);
    const from = ids.indexOf(id);
    if (from < 0) return;

    const targetIndex = rows.findIndex((row) => {
      const rect = row.getBoundingClientRect();
      return clientY < rect.top + rect.height / 2;
    });
    const to = targetIndex === -1 ? ids.length - 1 : targetIndex;
    if (from === to) return;
    store.setSectionOrder(section, moveItem(ids, from, to));
  }

  return (
    <section className="tw-section" data-testid={`section-${section}`}>
      <div className="tw-section__title">{section}</div>
      <div ref={listRef} className="tw-section__list">
        {controls.map((control, index) => (
          <SortableControl
            key={control.id}
            control={control}
            index={index}
            listRef={listRef}
            onKeyboardMove={moveControl}
            onPointerMove={moveControlToPointer}
          />
        ))}
      </div>
    </section>
  );
}

function SortableControl({
  control,
  index,
  listRef,
  onKeyboardMove,
  onPointerMove,
}: {
  control: NormalizedControl;
  index: number;
  listRef: RefObject<HTMLDivElement | null>;
  onKeyboardMove: (id: string, direction: -1 | 1) => void;
  onPointerMove: (id: string, clientY: number) => void;
}) {
  const store = useTweakerStore();
  const pointerDragRef = useRef<{ startY: number; moved: boolean } | null>(null);
  const { ref, handleRef, isDragging } = useSortable({
    id: control.id,
    index,
    group: control.section,
    data: { controlId: control.id },
    disabled: { draggable: !control.sortable },
    modifiers: [
      RestrictToVerticalAxis,
      RestrictToElement.configure({ element: () => listRef.current }),
    ],
  });

  return (
    <div
      ref={ref}
      className={`tw-row ${isDragging ? "is-dragging" : ""} ${
        control.sortable ? "" : "is-not-sortable"
      }`}
      data-control-id={control.id}
      data-sortable={control.sortable ? "true" : "false"}
      data-testid={`control-${control.key}`}
    >
      <button
        ref={handleRef}
        className="tw-grip"
        type="button"
        aria-label={
          control.sortable ? `Reorder ${control.label}` : `Reordering disabled for ${control.label}`
        }
        aria-disabled={!control.sortable}
        onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
          if (!control.sortable) return;
          pointerDragRef.current = { startY: event.clientY, moved: false };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event: PointerEvent<HTMLButtonElement>) => {
          if (!control.sortable) return;
          const drag = pointerDragRef.current;
          if (!drag) return;
          if (Math.abs(event.clientY - drag.startY) < 4) return;
          drag.moved = true;
          onPointerMove(control.id, event.clientY);
        }}
        onPointerUp={(event: PointerEvent<HTMLButtonElement>) => {
          if (!control.sortable) return;
          const drag = pointerDragRef.current;
          pointerDragRef.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
          if (drag?.moved) event.preventDefault();
        }}
        onPointerCancel={(event: PointerEvent<HTMLButtonElement>) => {
          if (!control.sortable) return;
          pointerDragRef.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onKeyDown={(event) => {
          if (!control.sortable) return;
          if (event.key === "ArrowUp") {
            event.preventDefault();
            onKeyboardMove(control.id, -1);
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            onKeyboardMove(control.id, 1);
          }
        }}
      >
        <GripVertical size={14} />
      </button>
      <label className="tw-row__label" htmlFor={control.id}>
        {control.label}
      </label>
      <ControlInput control={control} onChange={(value) => store.setValue(control.id, value)} />
    </div>
  );
}

function ControlInput({
  control,
  onChange,
}: {
  control: NormalizedControl;
  onChange: (value: PrimitiveValue) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  function commitNumber(value: string) {
    const parsed = Number(value);
    setDraft(null);
    if (Number.isFinite(parsed)) onChange(parsed);
  }

  if (control.kind === "checkbox") {
    return (
      <input
        id={control.id}
        className="tw-checkbox"
        type="checkbox"
        checked={Boolean(control.value)}
        onChange={(event) => onChange(event.target.checked)}
      />
    );
  }

  if (control.kind === "select") {
    return (
      <select
        id={control.id}
        className="tw-select"
        value={String(control.value)}
        onChange={(event) => onChange(event.target.value)}
      >
        {(control.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (control.kind === "slider") {
    return (
      <div className="tw-slider">
        <input
          id={control.id}
          type="range"
          min={control.min}
          max={control.max}
          step={control.step ?? 0.01}
          value={Number(control.value)}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span>{Number(control.value).toFixed(2)}</span>
      </div>
    );
  }

  return (
    <input
      id={control.id}
      className="tw-number"
      type="text"
      inputMode="decimal"
      value={draft ?? String(control.value)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => commitNumber(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          commitNumber(event.currentTarget.value);
          event.currentTarget.blur();
        }
      }}
    />
  );
}
