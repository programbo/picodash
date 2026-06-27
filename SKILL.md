---
name: tweaker
description: Use the local Tweaker React package to add a Leva-inspired floating config system with named panels, built-in controls, custom controls, persisted values, themes, status states, and reorderable sections.
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
  <TweakerPanel id="scene" defaultPlacement="top-right" theme="dark" />
  <TweakerPanel id="build" defaultPlacement="bottom-right" theme="system" />
</TweakerProvider>
```

Omitted panel IDs default to `"default"`, so existing single-panel usage remains straightforward.

## Register Controls

Call `useTweaker(schema, { panel, section, reorderable })` inside React components. It returns `[values, setValue]`. `reorderable` defaults to `true`.

```tsx
const [values, setValue] = useTweaker(
  {
    speed: { defaultValue: 0.75, min: 0, max: 2, status: "info" },
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
- Use `status: "info" | "alert" | "error"` on object controls for blue, amber, or red row states.
- Pass `reorderable: false` in hook options when a hook registration should not be draggable.
- Put panel opacity and backdrop blur on `TweakerPanel.appearance`, not hook options.
- Reordering is panel-local and section-local and starts from the grip handle.
- The package ships dark and light CSS-variable themes. Use `theme="system"` to follow `prefers-color-scheme`, or customize further by overriding CSS variables around the panel.
- Package styles may be authored with Tailwind internally, but consumers only import compiled plain CSS from `tweaker/style.css`.
- Compatibility aliases still work: `storeId`, `placement`, `sortable`, hook-level panel effects, and `value`.
