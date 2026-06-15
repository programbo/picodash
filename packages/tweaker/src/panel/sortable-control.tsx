import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { RestrictToElement } from "@dnd-kit/dom/modifiers";
import { useSortable } from "@dnd-kit/react/sortable";
import { GripVertical } from "lucide-react";
import { type PointerEvent, type RefObject, useRef } from "react";
import { Button } from "react-aria-components";
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
  const labelId = `${control.id}:label`;
  const footer = control.renderControlFooter?.(control);
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
      <Button
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
      </Button>
      <label id={labelId} className="tw-row__label" htmlFor={control.id}>
        {control.label}
      </label>
      <ControlInput
        control={control}
        labelId={labelId}
        onChange={(value) => setValue(control.id, value)}
      />
      {footer ? <div className="tw-row__footer">{footer}</div> : null}
    </div>
  );
}
