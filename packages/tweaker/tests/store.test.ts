import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  createTweakerStore,
  normalizeControl,
  type NormalizedControl,
  type TweakerSchema,
} from "../src/index.js";
import { defaultValueForControl } from "../src/control.js";
import { registrationSignatureForSchema, resolveTweakerValues } from "../src/react/use-tweaker.js";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  clear() {
    this.values.clear();
  }
}

const storage = new MemoryStorage();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal("window", { localStorage: storage });
});

describe("normalizeControl", () => {
  it("keeps legacy default-panel ids for section string registrations", () => {
    const control = normalizeControl("demo", "Rendering", "speed", {
      defaultValue: 0.5,
      min: 0,
      max: 1,
    });

    expect(control.kind).toBe("slider");
    expect(control.id).toBe("demo:Rendering:speed");
    expect(control.panelId).toBe("default");
    expect(control.sectionId).toBe("Rendering");
  });

  it("normalizes select records into label/value options", () => {
    const control = normalizeControl("demo", "Material", "shape", {
      type: "select",
      defaultValue: "orb",
      options: { Orb: "orb", Prism: "prism" },
    });

    expect(control.options).toEqual([
      { label: "Orb", value: "orb" },
      { label: "Prism", value: "prism" },
    ]);
  });

  it("normalizes status metadata on object controls", () => {
    const info = normalizeControl("demo", "Rendering", "speed", {
      defaultValue: 0.5,
      min: 0,
      max: 1,
      status: "info",
    });
    const alert = normalizeControl("demo", "Rendering", "exposure", {
      type: "number",
      defaultValue: 1,
      status: "alert",
    });
    const error = normalizeControl("demo", "Rendering", "bloom", {
      type: "checkbox",
      defaultValue: true,
      status: "error",
    });

    expect(info.status).toBe("info");
    expect(alert.status).toBe("alert");
    expect(error.status).toBe("error");
  });

  it("normalizes custom controls with JSON defaults", () => {
    const store = createTweakerStore({ id: "custom", persistence: false });
    store.getState().register(
      {
        position: {
          type: "vector3",
          id: "position",
          defaultValue: [0, 1, 0],
          label: "Position",
          size: "compact",
        },
      },
      { panel: "scene", section: { id: "transform", label: "Transform" } },
    );

    expect(store.getState().controls[0]).toMatchObject({
      kind: "custom",
      type: "vector3",
      persistId: "custom:scene:transform:position",
      value: [0, 1, 0],
      settings: { size: "compact" },
    });
  });
});

describe("control defaults", () => {
  it("extracts default values from every supported control shape", () => {
    expect(defaultValueForControl(1)).toBe(1);
    expect(defaultValueForControl(true)).toBe(true);
    expect(defaultValueForControl("green")).toBe("green");
    expect(defaultValueForControl({ type: "number", defaultValue: 2 })).toBe(2);
    expect(defaultValueForControl({ type: "number", value: 3 })).toBe(3);
    expect(defaultValueForControl({ type: "slider", defaultValue: 0.5, min: 0, max: 1 })).toBe(0.5);
    expect(defaultValueForControl({ type: "select", defaultValue: "orb", options: ["orb"] })).toBe(
      "orb",
    );
    expect(defaultValueForControl({ type: "checkbox", defaultValue: false })).toBe(false);
  });
});

describe("resolveTweakerValues", () => {
  const section = { id: "Rendering", label: "Rendering" };

  it("returns schema defaults before controls are registered", () => {
    const values = resolveTweakerValues(
      {
        exposure: { defaultValue: 1, min: 0, max: 4 },
        bloom: false,
        tint: { type: "select", defaultValue: "green", options: ["green", "amber"] },
      },
      "hook",
      "default",
      section,
      [],
      {},
    );

    expect(values).toEqual({ exposure: 1, bloom: false, tint: "green" });
  });

  it("prefers persisted values over schema defaults before controls are registered", () => {
    const values = resolveTweakerValues(
      {
        exposure: { defaultValue: 1, min: 0, max: 4 },
        bloom: true,
      },
      "hook",
      "default",
      section,
      [],
      {
        "hook:Rendering:exposure": 3,
        "hook:Rendering:bloom": false,
      },
    );

    expect(values).toEqual({ exposure: 3, bloom: false });
  });

  it("prefers live control values over persisted values", () => {
    const controls = [
      normalizeControl("hook", "Rendering", "exposure", {
        defaultValue: 2,
        min: 0,
        max: 4,
      }),
    ] satisfies NormalizedControl[];
    const values = resolveTweakerValues(
      { exposure: { defaultValue: 1, min: 0, max: 4 } },
      "hook",
      "default",
      section,
      controls,
      { "hook:Rendering:exposure": 3 },
    );

    expect(values).toEqual({ exposure: 2 });
  });
});

describe("schema signatures", () => {
  it("tracks status metadata changes", () => {
    const base = {
      speed: { defaultValue: 1, min: 0, max: 2, status: "info" },
    } satisfies TweakerSchema;
    const next = {
      speed: { defaultValue: 1, min: 0, max: 2, status: "error" },
    } satisfies TweakerSchema;

    expect(registrationSignatureForSchema(base)).not.toBe(registrationSignatureForSchema(next));
  });
});

describe("TweakerStore", () => {
  it("persists values and clamps numeric updates", () => {
    const schema = {
      exposure: { defaultValue: 1, min: 0, max: 4 },
    } satisfies TweakerSchema;
    const store = createTweakerStore({ id: "store" });

    store.getState().register(schema, { section: "Rendering" });
    store.getState().setValue("store:Rendering:exposure", 8);

    const next = createTweakerStore({ id: "store" });
    next.getState().register(schema, { section: "Rendering" });

    expect(next.getState().controls[0]?.value).toBe(4);
  });

  it("stores panel and section-local order", () => {
    const store = createTweakerStore({ id: "order", persistence: false });
    store.getState().register({ a: 1, b: 2 }, { panel: "scene", section: "Rendering" });
    store
      .getState()
      .setSectionOrder("scene", "Rendering", [
        "order:scene:Rendering:b",
        "order:scene:Rendering:a",
      ]);

    expect(store.getState().order.scene?.Rendering).toEqual([
      "order:scene:Rendering:b",
      "order:scene:Rendering:a",
    ]);
  });

  it("stores hook-level reorderable metadata and supports deprecated sortable", () => {
    const store = createTweakerStore({ id: "sortable", persistence: false });
    store.getState().register({ channel: "stable" }, { section: "Build", sortable: false });

    expect(store.getState().controls[0]?.reorderable).toBe(false);
    expect(store.getState().controls[0]?.sortable).toBe(false);
  });

  it("maps deprecated hook-level panel effects to panel appearance", () => {
    const store = createTweakerStore({ id: "opacity", persistence: false });
    store.getState().register({ channel: "stable" }, { panel: "build", section: "Build" });
    store.getState().updatePanelEffects(
      { channel: "stable" },
      {
        panel: "build",
        section: "Build",
        opacity: -1,
        hoverOpacity: 2,
        backgroundBlur: -4,
        hoverBackgroundBlur: 4,
      },
    );

    expect(store.getState().panelAppearances.build).toEqual({
      surfaceOpacity: 0,
      activeSurfaceOpacity: 1,
      backdropBlur: 0,
      activeBackdropBlur: 4,
    });
  });

  it("updates panel effects without pruning values or order", () => {
    const store = createTweakerStore({ id: "panel-effects", persistence: false });
    const schema = {
      speed: { defaultValue: 1, min: 0, max: 2 },
      exposure: 1,
    } satisfies TweakerSchema;

    store.getState().register(schema, { section: "Rendering" });
    store.getState().setValue("panel-effects:Rendering:speed", 1.5);
    store
      .getState()
      .setSectionOrder("default", "Rendering", [
        "panel-effects:Rendering:exposure",
        "panel-effects:Rendering:speed",
      ]);

    store.getState().updatePanelEffects(schema, {
      section: "Rendering",
      opacity: 0.4,
      hoverOpacity: 0.85,
      backgroundBlur: 0,
      hoverBackgroundBlur: 4,
    });

    expect(store.getState().values["panel-effects:Rendering:speed"]).toBe(1.5);
    expect(store.getState().order.default?.Rendering).toEqual([
      "panel-effects:Rendering:exposure",
      "panel-effects:Rendering:speed",
    ]);
    expect(store.getState().panelAppearances.default).toEqual({
      surfaceOpacity: 0.4,
      activeSurfaceOpacity: 0.85,
      backdropBlur: 0,
      activeBackdropBlur: 4,
    });
  });

  it("updates status metadata without pruning values or order", () => {
    const store = createTweakerStore({ id: "status-change", persistence: false });

    store
      .getState()
      .register({ speed: { defaultValue: 1, status: "info" } }, { section: "Rendering" });
    store.getState().setValue("status-change:Rendering:speed", 1.5);
    store.getState().setSectionOrder("default", "Rendering", ["status-change:Rendering:speed"]);
    store
      .getState()
      .register({ speed: { defaultValue: 1, status: "error" } }, { section: "Rendering" });

    expect(store.getState().values["status-change:Rendering:speed"]).toBe(1.5);
    expect(store.getState().order.default?.Rendering).toEqual(["status-change:Rendering:speed"]);
    expect(store.getState().controls[0]?.status).toBe("error");
  });

  it("does not notify when an equivalent schema registers again", () => {
    const store = createTweakerStore({ id: "stable-schema", persistence: false });
    const listener = vi.fn();

    store
      .getState()
      .register({ speed: { defaultValue: 1, min: 0, max: 2 } }, { section: "Rendering" });
    store.subscribe(listener);
    store
      .getState()
      .register({ speed: { defaultValue: 1, min: 0, max: 2 } }, { section: "Rendering" });

    expect(listener).not.toHaveBeenCalled();
  });

  it("does not prune stale persisted keys on unregister", () => {
    storage.setItem(
      "tweaker:stale",
      JSON.stringify({
        state: {
          values: { "stale:Rendering:remove": 9 },
          order: {},
          panels: {},
        },
      }),
    );
    const store = createTweakerStore({ id: "stale" });
    const unregister = store.getState().register({ remove: 2 }, { section: "Rendering" });

    expect(store.getState().values["stale:Rendering:remove"]).toBe(9);

    unregister();

    expect(store.getState().values["stale:Rendering:remove"]).toBe(9);
  });

  it("migrates legacy persisted panel layout into the default panel", () => {
    storage.setItem(
      "tweaker:legacy",
      JSON.stringify({
        state: {
          values: { "legacy:Rendering:exposure": 2 },
          order: { Rendering: ["legacy:Rendering:exposure"] },
          collapsed: true,
          dock: { edge: "left", offset: 16 },
        },
      }),
    );
    const store = createTweakerStore({ id: "legacy" });
    store.getState().register({ exposure: 1 }, { section: "Rendering" });

    expect(store.getState().values["legacy:Rendering:exposure"]).toBe(2);
    expect(store.getState().order.default?.Rendering).toEqual(["legacy:Rendering:exposure"]);
    expect(store.getState().panels.default).toEqual({
      collapsed: true,
      dock: { edge: "left", offset: 16 },
    });
  });

  it("migrates legacy dock state even when legacy order is empty", () => {
    storage.setItem(
      "tweaker:legacy-empty-order",
      JSON.stringify({
        state: {
          values: {},
          order: {},
          collapsed: false,
          dock: { edge: "right", offset: 80 },
        },
      }),
    );
    const store = createTweakerStore({ id: "legacy-empty-order" });

    expect(store.getState().panels.default).toEqual({
      collapsed: false,
      dock: { edge: "right", offset: 80 },
    });
  });

  it("keeps panel layout state independent", () => {
    const store = createTweakerStore({ id: "panels", persistence: false });

    store.getState().setPanelCollapsed("scene", true);
    store.getState().setPanelDock("build", { edge: "right", offset: 48 });

    expect(store.getState().getPanelState("scene")).toEqual({ collapsed: true, dock: null });
    expect(store.getState().getPanelState("build")).toEqual({
      collapsed: false,
      dock: { edge: "right", offset: 48 },
    });
  });

  it("preserves values when section labels and object keys change with stable ids", () => {
    const store = createTweakerStore({ id: "stable", persistence: false });
    store.getState().register(
      {
        speed: { id: "speed", defaultValue: 1, min: 0, max: 2 },
      },
      { panel: "scene", section: { id: "rendering", label: "Rendering" } },
    );
    store.getState().setValue("stable:scene:rendering:speed", 1.5);

    store.getState().register(
      {
        velocity: { id: "speed", defaultValue: 1, min: 0, max: 2 },
      },
      { panel: "scene", section: { id: "rendering", label: "Render Settings" } },
    );

    expect(store.getState().controls.find((control) => control.key === "velocity")?.value).toBe(
      1.5,
    );
  });

  it("persists custom JSON control values", () => {
    const schema = {
      position: { type: "vector3", id: "position", defaultValue: [0, 1, 0] },
    } satisfies TweakerSchema;
    const store = createTweakerStore({ id: "json" });

    store.getState().register(schema, {
      panel: "scene",
      section: { id: "transform", label: "Transform" },
    });
    store.getState().setValue("json:scene:transform:position", [2, 3, 4]);

    const next = createTweakerStore({ id: "json" });
    next.getState().register(schema, {
      panel: "scene",
      section: { id: "transform", label: "Transform" },
    });

    expect(next.getState().controls[0]?.value).toEqual([2, 3, 4]);
  });

  it("discards invalid localStorage data through the Zod storage boundary", () => {
    storage.setItem(
      "tweaker:invalid",
      JSON.stringify({
        state: {
          values: { "invalid:Rendering:exposure": 2 },
          order: [],
          panels: { default: { collapsed: "nope", dock: { edge: "diagonal", offset: -1 } } },
        },
      }),
    );

    const store = createTweakerStore({ id: "invalid" });
    store.getState().register({ exposure: 1 }, { section: "Rendering" });

    expect(store.getState().values).toEqual({});
    expect(store.getState().controls[0]?.value).toBe(1);
  });
});
