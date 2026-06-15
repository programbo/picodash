import { describe, expect, it, vi } from "vite-plus/test";
import {
  clampPosition,
  dockToPosition,
  nearestDock,
  placementToPosition,
} from "../src/panel/position.js";

function panel(width: number, height: number) {
  return {
    getBoundingClientRect: () => ({ width, height }),
  } as HTMLElement;
}

describe("panel docking position", () => {
  it("snaps to one edge when only one edge is within the magnetic threshold", () => {
    vi.stubGlobal("window", { innerWidth: 800, innerHeight: 600 });

    expect(nearestDock({ x: 2, y: 120 }, panel(320, 240))).toEqual({
      edge: "left",
      offset: 120,
    });
  });

  it("snaps to two perpendicular edges when both are within the magnetic threshold", () => {
    vi.stubGlobal("window", { innerWidth: 800, innerHeight: 600 });

    const dock = nearestDock({ x: 3, y: 4 }, panel(320, 240));

    expect(dock).toEqual({ edge: "left", secondaryEdge: "top", offset: 4 });
    expect(dockToPosition(dock!, 800, 600)).toEqual({ x: 0, y: 0 });
  });

  it("restores a docked corner from persisted dock state", () => {
    expect(
      dockToPosition({ edge: "right", secondaryEdge: "bottom", offset: 472 }, 800, 600),
    ).toEqual({
      x: 480,
      y: 480,
    });
  });

  it("clamps placement positions to the viewport", () => {
    vi.stubGlobal("window", { innerWidth: 280, innerHeight: 180 });

    expect(clampPosition(placementToPosition("top-right", 280, 180), null)).toEqual({
      x: 0,
      y: 16,
    });
  });
});
