import { z } from "zod";
import type { PersistStorage } from "zustand/middleware";
import type { PersistedState } from "../types.js";

export const storagePrefix = "tweaker:";

const primitiveValueSchema = z.union([z.number(), z.string(), z.boolean()]);

const dockStateSchema = z.object({
  edge: z.enum(["top", "right", "bottom", "left"]),
  secondaryEdge: z.enum(["top", "right", "bottom", "left"]).optional(),
  offset: z.number().finite().nonnegative(),
});

export const persistedStateSchema = z.object({
  values: z.record(z.string(), primitiveValueSchema).default({}),
  order: z.record(z.string(), z.array(z.string())).default({}),
  collapsed: z.boolean().default(false),
  dock: dockStateSchema.nullable().default(null),
});

const persistedStorageValueSchema = z.object({
  state: persistedStateSchema,
  version: z.number().optional(),
});

export function emptyPersistedState(): PersistedState {
  return { values: {}, order: {}, collapsed: false, dock: null };
}

export function createValidatedPersistStorage(): PersistStorage<PersistedState> {
  return {
    getItem(name) {
      if (typeof window === "undefined") return null;

      try {
        const raw = window.localStorage.getItem(name);
        if (!raw) return null;

        const parsed = persistedStorageValueSchema.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },
    setItem(name, value) {
      if (typeof window === "undefined") return;

      const parsed = persistedStorageValueSchema.safeParse(value);
      if (!parsed.success) return;

      window.localStorage.setItem(name, JSON.stringify(parsed.data));
    },
    removeItem(name) {
      if (typeof window === "undefined") return;
      window.localStorage.removeItem(name);
    },
  };
}
