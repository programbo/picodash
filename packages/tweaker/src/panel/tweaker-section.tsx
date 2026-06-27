import { useEffect, useRef, useState } from "react";
import { useTweakerSelector } from "../react/context.js";
import type { NormalizedControl } from "../types.js";
import { moveItem } from "./order.js";
import { SortableControl } from "./sortable-control.js";

interface TweakerSectionProps {
  panelId: string;
  sectionId: string;
  title: string;
  controls: NormalizedControl[];
}

export function TweakerSection({ panelId, sectionId, title, controls }: TweakerSectionProps) {
  const setSectionOrder = useTweakerSelector((state) => state.setSectionOrder);
  const listRef = useRef<HTMLDivElement | null>(null);
  const pointerDragIdRef = useRef<string | null>(null);
  const pointerDragInitialOrderRef = useRef<string[] | null>(null);
  const pointerDragNextOrderRef = useRef<string[] | null>(null);
  const pointerDragListRectRef = useRef<DOMRect | null>(null);
  const [listRevision, setListRevision] = useState(0);

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
    pointerDragInitialOrderRef.current = controls.map((control) => control.persistId);
    pointerDragNextOrderRef.current = null;
    pointerDragListRectRef.current = listRef.current?.getBoundingClientRect() ?? null;
  }

  function endPointerMove(id: string, clientX: number, clientY: number) {
    if (pointerDragIdRef.current !== id) return;
    if (!controls.find((control) => control.persistId === id)?.reorderable) return;
    const initialOrder = pointerDragInitialOrderRef.current;
    const nextOrder = pointerDragNextOrderRef.current;
    pointerDragIdRef.current = null;
    pointerDragInitialOrderRef.current = null;
    pointerDragNextOrderRef.current = null;
    const insideList = isPointerInsideList(clientX, clientY);
    pointerDragListRectRef.current = null;
    if (nextOrder && insideList) {
      setSectionOrder(panelId, sectionId, nextOrder);
    } else if (initialOrder && !insideList) {
      setSectionOrder(panelId, sectionId, initialOrder);
    }
    setListRevision((value) => value + 1);
  }

  function cancelPointerMove() {
    pointerDragIdRef.current = null;
    pointerDragInitialOrderRef.current = null;
    pointerDragNextOrderRef.current = null;
    pointerDragListRectRef.current = null;
    setListRevision((value) => value + 1);
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

    const targetIndex = rows.findIndex((row) => {
      const rect = row.getBoundingClientRect();
      return clientY < rect.top + rect.height / 2;
    });
    const to = targetIndex === -1 ? ids.length - 1 : targetIndex;
    if (from === to) return;
    pointerDragNextOrderRef.current = moveItem(ids, from, to);
  }

  useEffect(() => {
    const ownerDocument = listRef.current?.ownerDocument ?? document;

    function handlePointerUp(event: globalThis.PointerEvent) {
      const activeId = pointerDragIdRef.current;
      if (!activeId) return;
      endPointerMove(activeId, event.clientX, event.clientY);
    }

    function handlePointerCancel() {
      if (!pointerDragIdRef.current) return;
      cancelPointerMove();
    }

    ownerDocument.addEventListener("pointerup", handlePointerUp, true);
    ownerDocument.addEventListener("pointercancel", handlePointerCancel, true);
    return () => {
      ownerDocument.removeEventListener("pointerup", handlePointerUp, true);
      ownerDocument.removeEventListener("pointercancel", handlePointerCancel, true);
    };
  });

  return (
    <section className="tw-section" data-section-id={sectionId} data-testid={`section-${title}`}>
      <div className="tw-section__title">{title}</div>
      <div key={listRevision} ref={listRef} className="tw-section__list">
        {controls.map((control, index) => (
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
    </section>
  );
}
