---
name: tweaker
description: Use the local Tweaker React package to add a Leva-inspired floating config panel with numbers, sliders, selects, checkboxes, persisted values, and reorderable sections.
---

# Tweaker Package Usage

Use `tweaker` when a React app needs a compact floating configuration panel.

Internally, Tweaker uses a provider-scoped Zustand store. Persistence is handled by Zustand's `persist` middleware, and persisted localStorage data is Zod-validated before hydration.

## Required Imports

```tsx
import { TweakerPanel, TweakerProvider, useTweaker } from "tweaker";
import "tweaker/style.css";
```

## Provider and Panel

Wrap the app once with `TweakerProvider`. Always provide a stable `storeId`; it is used for localStorage persistence.

```tsx
<TweakerProvider storeId="my-app">
  <Controls />
  <TweakerPanel placement="top-right" theme="dark" />
</TweakerProvider>
```

`TweakerPanel` accepts `theme="dark"`, `theme="light"`, or `theme="system"` and defaults to `"dark"`.

## Register Controls

Call `useTweaker(schema, { section, sortable, opacity, hoverOpacity, backgroundBlur, hoverBackgroundBlur })` inside React components. It returns `[values, setValue]`. `sortable` defaults to `true`; panel effect settings are optional and apply to panel surface colors and backdrop blur.

```tsx
const [values, setValue] = useTweaker(
  {
    speed: { value: 0.75, min: 0, max: 2 },
    exposure: { type: "number", value: 1, min: 0, max: 4 },
    mode: { type: "select", value: "fast", options: ["fast", "quality"] },
    enabled: { value: true },
  },
  {
    section: "Rendering",
    sortable: true,
    opacity: 0.4,
    hoverOpacity: 0.85,
    backgroundBlur: 0,
    hoverBackgroundBlur: 4,
  },
);
```

## Constraints

- Supported controls are numbers, sliders, selects, and checkboxes.
- Min/max numeric shorthand becomes a slider.
- Use explicit `type: "number"` for bounded number inputs.
- Pass `sortable: false` in hook options when a section registration should not be draggable.
- Pass `opacity`, `hoverOpacity`, `backgroundBlur`, and `hoverBackgroundBlur` in hook options to animate panel surface color opacity and backdrop blur on hover or focus-within.
- Reordering is section-local and starts from the grip handle.
- The package ships dark and light CSS-variable themes. Use `theme="system"` to follow `prefers-color-scheme`, or customize further by overriding CSS variables around the panel.
