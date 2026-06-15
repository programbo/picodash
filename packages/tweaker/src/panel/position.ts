import type { DockState, Placement } from "../types.js";

export interface PanelPosition {
  x: number;
  y: number;
}

const edgeThreshold = 24;
const panelWidth = 320;

export function placementToPosition(placement: Placement, width: number, height: number) {
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

export function dockToPosition(dock: DockState, width: number, height: number) {
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

export function clampPosition(position: PanelPosition, element: HTMLElement | null) {
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

export function nearestDock(position: PanelPosition, element: HTMLElement): DockState | null {
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
