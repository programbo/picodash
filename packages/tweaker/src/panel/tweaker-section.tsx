import { useRef } from "react";
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

  function moveControl(id: string, direction: -1 | 1) {
    if (!controls.find((control) => control.persistId === id)?.reorderable) return;
    const ids = controls.map((control) => control.persistId);
    const from = ids.indexOf(id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= ids.length) return;
    setSectionOrder(panelId, sectionId, moveItem(ids, from, to));
  }

  function moveControlToPointer(id: string, clientY: number) {
    if (!controls.find((control) => control.persistId === id)?.reorderable) return;
    const list = listRef.current;
    if (!list) return;
    const listRect = list.getBoundingClientRect();
    if (clientY < listRect.top || clientY > listRect.bottom) return;

    const rows = Array.from(list.querySelectorAll<HTMLElement>("[data-control-id]"));
    const ids = controls.map((control) => control.persistId);
    const from = ids.indexOf(id);
    if (from < 0) return;

    const targetIndex = rows.findIndex((row) => {
      const rect = row.getBoundingClientRect();
      return clientY < rect.top + rect.height / 2;
    });
    const to = targetIndex === -1 ? ids.length - 1 : targetIndex;
    if (from === to) return;
    setSectionOrder(panelId, sectionId, moveItem(ids, from, to));
  }

  return (
    <section className="tw-section" data-testid={`section-${title}`}>
      <div className="tw-section__title">{title}</div>
      <div ref={listRef} className="tw-section__list">
        {controls.map((control, index) => (
          <SortableControl
            key={control.persistId}
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
