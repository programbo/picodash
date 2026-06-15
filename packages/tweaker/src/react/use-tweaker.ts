import { useCallback, useEffect, useMemo } from "react";
import { useStore } from "zustand";
import { defaultSection } from "../control.js";
import type { RegisterOptions, SetTweakerValue, TweakerSchema, TweakerValues } from "../types.js";
import { useTweakerStoreApi } from "./context.js";

export function useTweaker<T extends TweakerSchema>(
  schema: T,
  options: RegisterOptions = {},
): [TweakerValues<T>, SetTweakerValue<T>] {
  const store = useTweakerStoreApi();
  const section = options.section ?? defaultSection;
  const sortable = options.sortable ?? true;
  const state = useStore(store);

  useEffect(
    () => store.getState().register(schema, { section, sortable }),
    [store, schema, section, sortable],
  );

  const values = useMemo(() => {
    const output: Partial<TweakerValues<T>> = {};
    for (const key of Object.keys(schema) as Array<keyof T>) {
      const id = store.getState().getControlId(section, String(key));
      const control = state.controls.find((item) => item.id === id);
      output[key] = control?.value as TweakerValues<T>[keyof T];
    }
    return output as TweakerValues<T>;
  }, [schema, section, state.controls, store]);

  const setValue = useCallback<SetTweakerValue<T>>(
    (key, value) => {
      store.getState().setValue(store.getState().getControlId(section, String(key)), value);
    },
    [section, store],
  );

  return [values, setValue];
}
