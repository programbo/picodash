---
name: tweaker
description: Use the local Tweaker React package to add a Leva-inspired floating config system with named panels, built-in controls, custom controls, persisted values, and reorderable sections.
---

# Tweaker Package Usage

Use `tweaker` when a React app needs a compact floating configuration panel.

Internally, Tweaker uses a provider-scoped Zustand store. Persistence is handled by Zustand's `persist` middleware, and persisted localStorage data is Zod-validated before hydration.

## Required Imports

```tsx
import { TweakerPanel, TweakerProvider, useTweaker } from "tweaker";
import "tweaker/style.css";
```

## Provider and Panels

Wrap the app once with `TweakerProvider`. Always provide a stable `id`; it is used for localStorage persistence.

```tsx
<TweakerProvider id="my-app">
  <SceneControls />
  <BuildControls />
  <TweakerPanel id="scene" defaultPlacement="top-right" />
  <TweakerPanel id="build" defaultPlacement="bottom-right" />
</TweakerProvider>
```

Omitted panel IDs default to `"default"`, so existing single-panel usage remains straightforward.

## Register Controls

Call `useTweaker(schema, { panel, section, reorderable })` inside React components. It returns `[values, setValue]`. `reorderable` defaults to `true`.

```tsx
const [values, setValue] = useTweaker(
  {
    speed: { defaultValue: 0.75, min: 0, max: 2 },
    exposure: { type: "number", defaultValue: 1, min: 0, max: 4 },
    mode: { type: "select", defaultValue: "fast", options: ["fast", "quality"] },
    enabled: { defaultValue: true },
  },
  {
    panel: "scene",
    section: { id: "rendering", label: "Rendering" },
    reorderable: true,
  },
);
```

## Custom Controls

Register custom components once on the provider, then reference them by `type` in schemas.

```tsx
<TweakerProvider id="my-app" controls={{ color: ColorControl }}>
  <Controls />
  <TweakerPanel />
</TweakerProvider>
```

Custom control values must be JSON-serializable. Use control-level `id` when a schema key may change.

## Constraints

- Supported built-ins are numbers, sliders, selects, and checkboxes.
- Min/max numeric shorthand becomes a slider.
- Use explicit `type: "number"` for bounded number inputs.
- Pass `reorderable: false` in hook options when a hook registration should not be draggable.
- Put panel opacity and backdrop blur on `TweakerPanel.appearance`, not hook options.
- Reordering is panel-local and section-local and starts from the grip handle.
- The package ships a dark CSS-variable theme first; customize by overriding CSS variables around the panel.
- Compatibility aliases still work: `storeId`, `placement`, `sortable`, hook-level panel effects, and `value`.
