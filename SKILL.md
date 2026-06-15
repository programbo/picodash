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
  <TweakerPanel placement="top-right" />
</TweakerProvider>
```

## Register Controls

Call `useTweaker(schema, { section, sortable, opacity, hoverOpacity, backgroundBlur, hoverBackgroundBlur, tooltipForeground })` inside React components. It returns `[values, setValue]`. `sortable` defaults to `true`; panel effect settings are optional and apply to panel surface colors, backdrop blur, and default tooltip foreground color.

```tsx
const [values, setValue] = useTweaker(
  {
    speed: {
      value: 0.75,
      min: 0,
      max: 2,
      tooltip: <>Higher values shorten the animation loop.</>,
    },
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
    tooltipForeground: "#d5f4ff",
  },
);
```

## Constraints

- Supported controls are numbers, sliders, selects, and checkboxes.
- Object-shaped controls support `tooltip` as plain text or React content beside the label.
- Min/max numeric shorthand becomes a slider.
- Use explicit `type: "number"` for bounded number inputs.
- Pass `sortable: false` in hook options when a section registration should not be draggable.
- Pass `opacity`, `hoverOpacity`, `backgroundBlur`, and `hoverBackgroundBlur` in hook options to animate panel surface color opacity and backdrop blur on hover, focus-within, or open tooltip state.
- Pass `tooltipForeground` in hook options to set the default tooltip content color.
- Reordering is section-local and starts from the grip handle.
- The package ships a dark CSS-variable theme first; customize by overriding CSS variables around the panel.
