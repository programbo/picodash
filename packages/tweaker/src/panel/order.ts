import type { NormalizedControl } from "../types.js";

export function orderControls(
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

export function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item) next.splice(to, 0, item);
  return next;
}
