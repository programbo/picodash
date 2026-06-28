import { clsx } from "clsx";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { useTweakerSelector } from "../react/context.js";
import type { NormalizedControl } from "../types.js";
import {
  type ControlOrderSnapshot,
  captureControlOrderSnapshot,
  controlOrderFromPointer,
  controlOrderFromPointerSnapshot,
  moveItem,
  orderControls,
} from "./order.js";
import { SortableControl } from "./sortable-control.js";

interface TweakerSectionProps {
  panelId: string;
  sectionId: string;
  title: string;
  controls: NormalizedControl[];
}

function orderChanged(left: string[] | null, right: string[]) {
  return (
    !left || left.length !== right.length || left.some((value, index) => value !== right[index])
  );
}

export function TweakerSection({ panelId, sectionId, title, controls }: TweakerSectionProps) {
  const storedCollapsed = useTweakerSelector(
    (state) => state.sections[panelId]?.[sectionId] ?? false,
  );
  const setSectionCollapsed = useTweakerSelector((state) => state.setSectionCollapsed);
  const setSectionOrder = useTweakerSelector((state) => state.setSectionOrder);
  // A headerless section (empty label) cannot be collapsed: there is no toggle
  // to expand it again, so it stays expanded regardless of stored state.
  const headerless = title === "";
  const collapsed = headerless ? false : storedCollapsed;
  const listRef = useRef<HTMLDivElement | null>(null);
  const pointerDragIdRef = useRef<string | null>(null);
  const pointerDragInitialOrderRef = useRef<string[] | null>(null);
  const pointerDragOrderSnapshotRef = useRef<ControlOrderSnapshot[] | null>(null);
  const pointerDragNextOrderRef = useRef<string[] | null>(null);
  const pointerDragListRectRef = useRef<DOMRect | null>(null);
  const [dragPreviewOrder, setDragPreviewOrder] = useState<string[] | null>(null);

  const displayedControls = useMemo(() => {
    if (!dragPreviewOrder) return controls;
    return orderControls(controls, sectionId, { [sectionId]: dragPreviewOrder });
  }, [controls, dragPreviewOrder, sectionId]);

  function moveControl(id: string, direction: -1 | 1) {
    if (!controls.find((control) => control.persistId === id)?.reorderable) return;
    const ids = controls.map((control) => control.persistId);
    const from = ids.indexOf(id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= ids.length) return;
    setSectionOrder(panelId, sectionId, moveItem(ids, from, to));
  }

  function isPointerInsideList(clientX: number, clientY: number) {
    const list = listRef.current;
    if (!list) return false;
    const listRect = pointerDragListRectRef.current ?? list.getBoundingClientRect();
    return !(
      clientX < listRect.left ||
      clientX > listRect.right ||
      clientY < listRect.top ||
      clientY > listRect.bottom
    );
  }

  function startPointerMove(id: string) {
    if (!controls.find((control) => control.persistId === id)?.reorderable) return;
    pointerDragIdRef.current = id;
    const initialOrder = controls.map((control) => control.persistId);
    pointerDragInitialOrderRef.current = initialOrder;
    pointerDragOrderSnapshotRef.current = captureControlOrderSnapshot(
      listRef.current,
      initialOrder,
    );
    pointerDragNextOrderRef.current = null;
    pointerDragListRectRef.current = listRef.current?.getBoundingClientRect() ?? null;
    setDragPreviewOrder(null);
  }

  function endPointerMove(id: string, clientX: number, clientY: number) {
    if (pointerDragIdRef.current !== id) return;
    if (!controls.find((control) => control.persistId === id)?.reorderable) return;
    const initialOrder = pointerDragInitialOrderRef.current;
    const hasPointerDragOrder = pointerDragNextOrderRef.current !== null;
    const list = listRef.current;
    const nextOrder =
      hasPointerDragOrder && initialOrder && list
        ? (controlOrderFromPointerSnapshot(pointerDragOrderSnapshotRef.current, id, clientY) ??
          controlOrderFromPointer(list, initialOrder, id, clientY) ??
          pointerDragNextOrderRef.current)
        : pointerDragNextOrderRef.current;
    pointerDragIdRef.current = null;
    pointerDragInitialOrderRef.current = null;
    pointerDragOrderSnapshotRef.current = null;
    pointerDragNextOrderRef.current = null;
    const insideList = isPointerInsideList(clientX, clientY);
    pointerDragListRectRef.current = null;
    if (nextOrder && insideList && orderChanged(initialOrder, nextOrder)) {
      setDragPreviewOrder(nextOrder);
      setSectionOrder(panelId, sectionId, nextOrder);
    } else if (initialOrder && !insideList) {
      setDragPreviewOrder(initialOrder);
    }
    requestAnimationFrame(() => setDragPreviewOrder(null));
  }

  function cancelPointerMove() {
    pointerDragIdRef.current = null;
    pointerDragInitialOrderRef.current = null;
    pointerDragOrderSnapshotRef.current = null;
    pointerDragNextOrderRef.current = null;
    pointerDragListRectRef.current = null;
    setDragPreviewOrder(null);
  }

  function moveControlToPointer(id: string, clientX: number, clientY: number) {
    if (!controls.find((control) => control.persistId === id)?.reorderable) return;
    if (!isPointerInsideList(clientX, clientY)) return;
    const list = listRef.current;
    if (!list) return;

    const rows = Array.from(list.querySelectorAll<HTMLElement>("[data-control-id]"));
    const ids = pointerDragInitialOrderRef.current ?? controls.map((control) => control.persistId);
    const from = ids.indexOf(id);
    if (from < 0) return;
    const pointerOrder =
      controlOrderFromPointerSnapshot(pointerDragOrderSnapshotRef.current, id, clientY) ??
      controlOrderFromPointer(list, ids, id, clientY);
    if (pointerOrder) {
      pointerDragNextOrderRef.current = pointerOrder;
      setDragPreviewOrder(pointerOrder);
      return;
    }

    const targetIndex = rows.findIndex((row) => {
      const rect = row.getBoundingClientRect();
      return clientY < rect.top + rect.height / 2;
    });
    const to = targetIndex === -1 ? ids.length - 1 : targetIndex;
    if (from === to) return;
    const nextOrder = moveItem(ids, from, to);
    pointerDragNextOrderRef.current = nextOrder;
    setDragPreviewOrder(nextOrder);
  }

  useEffect(() => {
    const ownerDocument = listRef.current?.ownerDocument ?? document;

    function handlePointerMove(event: globalThis.PointerEvent) {
      const activeId = pointerDragIdRef.current;
      if (!activeId) return;
      moveControlToPointer(activeId, event.clientX, event.clientY);
    }

    function handlePointerUp(event: globalThis.PointerEvent) {
      const activeId = pointerDragIdRef.current;
      if (!activeId) return;
      endPointerMove(activeId, event.clientX, event.clientY);
    }

    function handlePointerCancel() {
      if (!pointerDragIdRef.current) return;
      cancelPointerMove();
    }

    ownerDocument.addEventListener("pointermove", handlePointerMove, true);
    ownerDocument.addEventListener("pointerup", handlePointerUp, true);
    ownerDocument.addEventListener("pointercancel", handlePointerCancel, true);
    return () => {
      ownerDocument.removeEventListener("pointermove", handlePointerMove, true);
      ownerDocument.removeEventListener("pointerup", handlePointerUp, true);
      ownerDocument.removeEventListener("pointercancel", handlePointerCancel, true);
    };
  });

  return (
    <section
      className={clsx("tw-section", collapsed && "is-collapsed", headerless && "is-headerless")}
      data-section-id={sectionId}
      data-headerless={headerless ? "true" : "false"}
      data-testid={`section-${title || sectionId}`}
    >
      {!headerless && (
        <div className="tw-section__header">
          <Button
            className="tw-icon-button tw-section__toggle"
            type="button"
            aria-label={collapsed ? `Expand section ${title}` : `Collapse section ${title}`}
            onPress={() => setSectionCollapsed(panelId, sectionId, !collapsed)}
          >
            {collapsed ? (
              <ChevronRight size={18} strokeWidth={2.4} />
            ) : (
              <ChevronDown size={18} strokeWidth={2.4} />
            )}
          </Button>
          <div className="tw-section__title">{title}</div>
        </div>
      )}
      {!collapsed && (
        <div ref={listRef} className="tw-section__list">
          {displayedControls.map((control, index) => (
            <SortableControl
              key={control.persistId}
              control={control}
              index={index}
              listRef={listRef}
              onKeyboardMove={moveControl}
              onPointerStart={startPointerMove}
              onPointerMove={moveControlToPointer}
              onPointerEnd={endPointerMove}
              onPointerCancel={cancelPointerMove}
            />
          ))}
        </div>
      )}
    </section>
  );
}
