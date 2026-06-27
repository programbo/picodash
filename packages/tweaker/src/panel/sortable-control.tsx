import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { RestrictToElement } from "@dnd-kit/dom/modifiers";
import { useSortable } from "@dnd-kit/react/sortable";
import { GripVertical } from "lucide-react";
import { type PointerEvent, type RefObject, useRef } from "react";
import { useTweakerSelector } from "../react/context.js";
import type { NormalizedControl } from "../types.js";
import { ControlInput } from "./control-input.js";

interface SortableControlProps {
  control: NormalizedControl;
  index: number;
  listRef: RefObject<HTMLDivElement | null>;
  onKeyboardMove: (id: string, direction: -1 | 1) => void;
  onPointerMove: (id: string, clientY: number) => void;
}

export function SortableControl({
  control,
  index,
  listRef,
  onKeyboardMove,
  onPointerMove,
}: SortableControlProps) {
  const setValue = useTweakerSelector((state) => state.setValue);
  const pointerDragRef = useRef<{ startY: number; moved: boolean } | null>(null);
  const { ref, handleRef, isDragging } = useSortable({
    id: control.persistId,
    index,
    group: `${control.panelId}:${control.sectionId}`,
    data: { controlId: control.persistId, panelId: control.panelId, sectionId: control.sectionId },
    accept: (source) =>
      source.data.panelId === control.panelId && source.data.sectionId === control.sectionId,
    disabled: { draggable: !control.reorderable },
    modifiers: [
      RestrictToVerticalAxis,
      RestrictToElement.configure({ element: () => listRef.current }),
    ],
  });

  return (
    <div
      ref={ref}
      className={`tw-row ${isDragging ? "is-dragging" : ""} ${
        control.reorderable ? "" : "is-not-sortable"
      }`}
      data-control-id={control.persistId}
      data-sortable={control.reorderable ? "true" : "false"}
      data-testid={`control-${control.key}`}
    >
      <button
        ref={handleRef}
        className="tw-grip"
        type="button"
        aria-label={
          control.reorderable
            ? `Reorder ${control.label}`
            : `Reordering disabled for ${control.label}`
        }
        aria-disabled={!control.reorderable}
        onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
          if (!control.reorderable) return;
          pointerDragRef.current = { startY: event.clientY, moved: false };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event: PointerEvent<HTMLButtonElement>) => {
          if (!control.reorderable) return;
          const drag = pointerDragRef.current;
          if (!drag) return;
          if (Math.abs(event.clientY - drag.startY) < 4) return;
          drag.moved = true;
          onPointerMove(control.id, event.clientY);
        }}
        onPointerUp={(event: PointerEvent<HTMLButtonElement>) => {
          if (!control.reorderable) return;
          const drag = pointerDragRef.current;
          pointerDragRef.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
          if (drag?.moved) event.preventDefault();
        }}
        onPointerCancel={(event: PointerEvent<HTMLButtonElement>) => {
          if (!control.reorderable) return;
          pointerDragRef.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onKeyDown={(event) => {
          if (!control.reorderable) return;
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
      <label className="tw-row__label" htmlFor={control.domId}>
        {control.label}
      </label>
      <ControlInput control={control} onChange={(value) => setValue(control.persistId, value)} />
    </div>
  );
}
