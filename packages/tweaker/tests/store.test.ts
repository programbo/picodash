import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { normalizeControl, TweakerStore, type TweakerSchema } from "../src/index.js";

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

describe("TweakerStore", () => {
  it("persists values and clamps numeric updates", () => {
    const schema = {
      exposure: { value: 1, min: 0, max: 4 },
    } satisfies TweakerSchema;
    const store = new TweakerStore({ storeId: "store", stale: "ignore" });

    store.register(schema, { section: "Rendering" });
    store.setValue("store:Rendering:exposure", 8);

    const next = new TweakerStore({ storeId: "store", stale: "ignore" });
    next.register(schema, { section: "Rendering" });

    expect(next.getSnapshot().controls[0]?.value).toBe(4);
  });

  it("stores section-local order", () => {
    const store = new TweakerStore({ storeId: "order", stale: "ignore" });
    store.register({ a: 1, b: 2 }, { section: "Rendering" });
    store.setSectionOrder("Rendering", ["order:Rendering:b", "order:Rendering:a"]);

    expect(store.getSnapshot().order.Rendering).toEqual(["order:Rendering:b", "order:Rendering:a"]);
  });

  it("stores hook-level sortable metadata on registered controls", () => {
    const store = new TweakerStore({ storeId: "sortable", stale: "ignore" });
    store.register({ channel: "stable" }, { section: "Build", sortable: false });

    expect(store.getSnapshot().controls[0]?.sortable).toBe(false);
  });

  it("prunes stale persisted keys when configured", () => {
    const store = new TweakerStore({ storeId: "stale", stale: "ignore" });
    store.register({ keep: 1, remove: 2 }, { section: "Rendering" });
    store.setValue("stale:Rendering:remove", 9);

    const next = new TweakerStore({ storeId: "stale", stale: "prune" });
    next.register({ keep: 1 }, { section: "Rendering" });

    expect(next.getSnapshot().values["stale:Rendering:remove"]).toBeUndefined();
  });
});
