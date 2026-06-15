import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { RestrictToElement } from "@dnd-kit/dom/modifiers";
import { useSortable } from "@dnd-kit/react/sortable";
import { clsx } from "clsx";
import { CircleHelp, GripVertical } from "lucide-react";
import { type PointerEvent, type RefObject, useEffect, useRef, useState } from "react";
import { Button, OverlayArrow, Tooltip, TooltipTrigger } from "react-aria-components";
import { useTweakerSelector } from "../react/context.js";
import type { NormalizedControl } from "../types.js";
import { ControlInput } from "./control-input.js";
import { usePanelEffectStyle, usePanelOverlayActivity } from "./panel-effects-context.js";

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
  const tooltipCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const panelEffectStyle = usePanelEffectStyle();
  const setPanelOverlayActive = usePanelOverlayActivity();
  const labelId = `${control.id}:label`;
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

  function clearTooltipCloseTimer() {
    if (!tooltipCloseTimerRef.current) return;
    clearTimeout(tooltipCloseTimerRef.current);
    tooltipCloseTimerRef.current = null;
  }

  function openTooltip() {
    clearTooltipCloseTimer();
    setTooltipOpen(true);
    setPanelOverlayActive(true);
  }

  function closeTooltip() {
    clearTooltipCloseTimer();
    setTooltipOpen(false);
    setPanelOverlayActive(false);
  }

  function queueTooltipClose() {
    clearTooltipCloseTimer();
    tooltipCloseTimerRef.current = setTimeout(closeTooltip, 180);
  }

  useEffect(() => {
    return () => {
      clearTooltipCloseTimer();
      setPanelOverlayActive(false);
    };
  }, [setPanelOverlayActive]);

  return (
    <div
      ref={ref}
      className={clsx(
        "tw-row",
        isDragging && "is-dragging",
        !control.sortable && "is-not-sortable",
        control.status && `tw-row--${control.status}`,
      )}
      data-control-id={control.id}
      data-sortable={control.sortable ? "true" : "false"}
      data-status={control.status}
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
      <div className="tw-row__label-cell">
        <label id={labelId} className="tw-row__label" htmlFor={control.id}>
          <span className="tw-row__label-text">{control.label}</span>
        </label>
        {control.tooltip ? (
          <TooltipTrigger
            delay={0}
            closeDelay={250}
            isOpen={tooltipOpen}
            onOpenChange={(open) => {
              if (open) {
                openTooltip();
              } else {
                queueTooltipClose();
              }
            }}
          >
            <Button
              className="tw-tooltip-trigger"
              type="button"
              aria-label={`About ${control.label}`}
              onPointerEnter={openTooltip}
              onPointerLeave={queueTooltipClose}
            >
              <CircleHelp size={12} />
            </Button>
            <Tooltip
              className="tw-tooltip"
              placement="right"
              onPointerEnter={openTooltip}
              onPointerLeave={queueTooltipClose}
            >
              <OverlayArrow>
                <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
                  <path d="M0 0 L4 4 L8 0" />
                </svg>
              </OverlayArrow>
              <div className="tw-tooltip__content" style={panelEffectStyle}>
                {control.tooltip}
              </div>
            </Tooltip>
          </TooltipTrigger>
        ) : null}
      </div>
      <ControlInput
        control={control}
        labelId={labelId}
        onChange={(value) => setValue(control.id, value)}
      />
    </div>
  );
}
