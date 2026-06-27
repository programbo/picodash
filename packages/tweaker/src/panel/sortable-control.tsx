import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { RestrictToElement } from "@dnd-kit/dom/modifiers";
import { useSortable } from "@dnd-kit/react/sortable";
import { clsx } from "clsx";
import { GripVertical, HelpCircle } from "lucide-react";
import { type PointerEvent, type RefObject, useRef } from "react";
import { Button, OverlayArrow, Tooltip, TooltipTrigger } from "react-aria-components";
import { useTweakerSelector } from "../react/context.js";
import type { NormalizedControl } from "../types.js";
import { ControlInput } from "./control-input.js";
import { usePanelEffects } from "./panel-effects-context.js";

interface SortableControlProps {
  control: NormalizedControl;
  index: number;
  listRef: RefObject<HTMLDivElement | null>;
  onKeyboardMove: (id: string, direction: -1 | 1) => void;
  onPointerStart: (id: string) => void;
  onPointerMove: (id: string, clientX: number, clientY: number) => void;
  onPointerEnd: (id: string, clientX: number, clientY: number) => void;
  onPointerCancel: (id: string) => void;
}

export function SortableControl({
  control,
  index,
  listRef,
  onKeyboardMove,
  onPointerStart,
  onPointerMove,
  onPointerEnd,
  onPointerCancel,
}: SortableControlProps) {
  const setValue = useTweakerSelector((state) => state.setValue);
  const panelEffects = usePanelEffects();
  const pointerDragRef = useRef<{ startY: number; moved: boolean } | null>(null);
  const labelId = `${control.domId}:label`;
  const { ref, handleRef, isDragging } = useSortable({
    id: control.persistId,
    index,
    group: `${control.panelId}:${control.sectionId}`,
    data: { controlId: control.persistId, panelId: control.panelId, sectionId: control.sectionId },
    accept: (source) =>
      source.id !== control.persistId &&
      source.data.panelId === control.panelId &&
      source.data.sectionId === control.sectionId,
    disabled: { draggable: !control.reorderable },
    modifiers: [
      RestrictToVerticalAxis,
      RestrictToElement.configure({ element: () => listRef.current }),
    ],
    plugins: [],
  });

  return (
    <div
      ref={ref}
      className={clsx(
        "tw-row",
        isDragging && "is-dragging",
        !control.reorderable && "is-not-sortable",
        control.status && `tw-row--${control.status}`,
      )}
      data-control-id={control.persistId}
      data-sortable={control.reorderable ? "true" : "false"}
      data-status={control.status}
      data-testid={`control-${control.key}`}
    >
      <Button
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
          onPointerStart(control.persistId);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event: PointerEvent<HTMLButtonElement>) => {
          if (!control.reorderable) return;
          const drag = pointerDragRef.current;
          if (!drag) return;
          if (Math.abs(event.clientY - drag.startY) < 4) return;
          drag.moved = true;
          onPointerMove(control.persistId, event.clientX, event.clientY);
        }}
        onPointerUp={(event: PointerEvent<HTMLButtonElement>) => {
          if (!control.reorderable) return;
          const drag = pointerDragRef.current;
          pointerDragRef.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
          onPointerEnd(control.persistId, event.clientX, event.clientY);
          if (drag?.moved) event.preventDefault();
        }}
        onPointerCancel={(event: PointerEvent<HTMLButtonElement>) => {
          if (!control.reorderable) return;
          pointerDragRef.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
          onPointerCancel(control.persistId);
        }}
        onLostPointerCapture={(event: PointerEvent<HTMLButtonElement>) => {
          if (!control.reorderable) return;
          const drag = pointerDragRef.current;
          if (!drag) return;
          pointerDragRef.current = null;
          onPointerEnd(control.persistId, event.clientX, event.clientY);
        }}
        onKeyDown={(event) => {
          if (!control.reorderable) return;
          if (event.key === "ArrowUp") {
            event.preventDefault();
            onKeyboardMove(control.persistId, -1);
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            onKeyboardMove(control.persistId, 1);
          }
        }}
      >
        <GripVertical size={14} />
      </Button>
      <div className="tw-row__label-wrap">
        <label id={labelId} className="tw-row__label" htmlFor={control.domId}>
          {control.label}
        </label>
        {control.help ? (
          <TooltipTrigger delay={0} closeDelay={100}>
            <Button
              className="tw-help"
              type="button"
              aria-label={`Help for ${control.label}`}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <HelpCircle aria-hidden size={13} />
            </Button>
            <Tooltip
              className="tw-tooltip"
              data-theme={panelEffects.theme}
              style={panelEffects.style}
              offset={6}
              placement="top"
            >
              <OverlayArrow className="tw-tooltip__arrow">
                <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
                  <path d="M0 0L4 4L8 0" />
                </svg>
              </OverlayArrow>
              {control.help}
            </Tooltip>
          </TooltipTrigger>
        ) : null}
      </div>
      <ControlInput
        control={control}
        labelId={labelId}
        onChange={(value) => setValue(control.persistId, value)}
      />
    </div>
  );
}
