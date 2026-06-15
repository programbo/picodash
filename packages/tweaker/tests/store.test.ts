import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  createTweakerStore,
  normalizeControl,
  type NormalizedControl,
  type TweakerSchema,
} from "../src/index.js";
import { defaultValueForControl } from "../src/control.js";
import { resolveTweakerValues } from "../src/react/use-tweaker.js";

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
  it("infers sliders from numeric shorthand with min and max", () => {
    const control = normalizeControl("demo", "Rendering", "speed", {
      value: 0.5,
      min: 0,
      max: 1,
    });

    expect(control.kind).toBe("slider");
    expect(control.id).toBe("demo:Rendering:speed");
  });

  it("normalizes select records into label/value options", () => {
    const control = normalizeControl("demo", "Material", "shape", {
      type: "select",
      value: "orb",
      options: { Orb: "orb", Prism: "prism" },
    });

    expect(control.options).toEqual([
      { label: "Orb", value: "orb" },
      { label: "Prism", value: "prism" },
    ]);
  });
});

describe("control defaults", () => {
  it("extracts default values from every supported control shape", () => {
    expect(defaultValueForControl(1)).toBe(1);
    expect(defaultValueForControl(true)).toBe(true);
    expect(defaultValueForControl("green")).toBe("green");
    expect(defaultValueForControl({ type: "number", value: 2 })).toBe(2);
    expect(defaultValueForControl({ type: "slider", value: 0.5, min: 0, max: 1 })).toBe(0.5);
    expect(defaultValueForControl({ type: "select", value: "orb", options: ["orb"] })).toBe("orb");
    expect(defaultValueForControl({ type: "checkbox", value: false })).toBe(false);
  });
});

describe("resolveTweakerValues", () => {
  const getControlId = (section: string, key: string) => `hook:${section}:${key}`;

  it("returns schema defaults before controls are registered", () => {
    const values = resolveTweakerValues(
      {
        exposure: { value: 1, min: 0, max: 4 },
        bloom: false,
        tint: { type: "select", value: "green", options: ["green", "amber"] },
      },
      "Rendering",
      [],
      {},
      getControlId,
    );

    expect(values).toEqual({ exposure: 1, bloom: false, tint: "green" });
  });

  it("prefers persisted values over schema defaults before controls are registered", () => {
    const values = resolveTweakerValues(
      {
        exposure: { value: 1, min: 0, max: 4 },
        bloom: true,
      },
      "Rendering",
      [],
      {
        "hook:Rendering:exposure": 3,
        "hook:Rendering:bloom": false,
      },
      getControlId,
    );

    expect(values).toEqual({ exposure: 3, bloom: false });
  });

  it("prefers live control values over persisted values", () => {
    const controls = [
      normalizeControl("hook", "Rendering", "exposure", { value: 2, min: 0, max: 4 }),
    ] satisfies NormalizedControl[];
    const values = resolveTweakerValues(
      { exposure: { value: 1, min: 0, max: 4 } },
      "Rendering",
      controls,
      { "hook:Rendering:exposure": 3 },
      getControlId,
    );

    expect(values).toEqual({ exposure: 2 });
  });
});

describe("TweakerStore", () => {
  it("persists values and clamps numeric updates", () => {
    const schema = {
      exposure: { value: 1, min: 0, max: 4 },
    } satisfies TweakerSchema;
    const store = createTweakerStore({ storeId: "store", stale: "ignore" });

    store.getState().register(schema, { section: "Rendering" });
    store.getState().setValue("store:Rendering:exposure", 8);

    const next = createTweakerStore({ storeId: "store", stale: "ignore" });
    next.getState().register(schema, { section: "Rendering" });

    expect(next.getState().controls[0]?.value).toBe(4);
  });

  it("stores section-local order", () => {
    const store = createTweakerStore({ storeId: "order", stale: "ignore" });
    store.getState().register({ a: 1, b: 2 }, { section: "Rendering" });
    store.getState().setSectionOrder("Rendering", ["order:Rendering:b", "order:Rendering:a"]);

    expect(store.getState().order.Rendering).toEqual(["order:Rendering:b", "order:Rendering:a"]);
  });

  it("stores hook-level sortable metadata on registered controls", () => {
    const store = createTweakerStore({ storeId: "sortable", stale: "ignore" });
    store.getState().register({ channel: "stable" }, { section: "Build", sortable: false });

    expect(store.getState().controls[0]?.sortable).toBe(false);
  });

  it("prunes stale persisted keys when configured", () => {
    const store = createTweakerStore({ storeId: "stale", stale: "ignore" });
    store.getState().register({ keep: 1, remove: 2 }, { section: "Rendering" });
    store.getState().setValue("stale:Rendering:remove", 9);

    const next = createTweakerStore({ storeId: "stale", stale: "prune" });
    next.getState().register({ keep: 1 }, { section: "Rendering" });

    expect(next.getState().values["stale:Rendering:remove"]).toBeUndefined();
  });

  it("discards invalid localStorage data through the Zod storage boundary", () => {
    storage.setItem(
      "tweaker:invalid",
      JSON.stringify({
        state: {
          values: { "invalid:Rendering:exposure": { nested: "not primitive" } },
          order: [],
          collapsed: "nope",
          dock: { edge: "diagonal", offset: -1 },
        },
      }),
    );

    const store = createTweakerStore({ storeId: "invalid", stale: "ignore" });
    store.getState().register({ exposure: 1 }, { section: "Rendering" });

    expect(store.getState().values).toEqual({});
    expect(store.getState().controls[0]?.value).toBe(1);
  });
});
