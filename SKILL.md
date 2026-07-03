---
name: tweaker
description: Use the local Tweaker React package to add a Leva-inspired floating config system with named panels, built-in controls, display readouts, custom controls, dynamic schemas, persisted values, themes, status states, help tooltips, collapsible sections, and reorderable sections.
---

# Tweaker Package Usage

Use `tweaker` when a React app needs a compact floating configuration panel.

Internally, Tweaker uses a provider-scoped Zustand store. Persistence is handled by Zustand's `persist` middleware, and persisted localStorage data is Zod-validated before hydration.

## Required Imports

```tsx
import { TweakerPanel, TweakerProvider, useTweaker } from 'tweaker'
import 'tweaker/style.css'
```

## Repo Workspaces

- `packages/tweaker`: the main reusable Tweaker React package.
- `apps/website`: the Tweaker demo/docs and Playwright e2e surface.
- `packages/panel`: a Vite+ React component library that exports typed components from `src/index.ts` and compiled Tailwind-authored CSS from `panel/style.css`.
- `apps/demo`: a Vite+ React TypeScript Tailwind app that imports `panel` through `workspace:*`.

## Provider and Panels

Wrap the app once with `TweakerProvider`. Always provide a stable `id`; it is used for localStorage persistence.

```tsx
<TweakerProvider id="my-app">
  <SceneControls />
  <BuildControls />
  <TweakerPanel id="scene" defaultPlacement="top-right" theme="dark" width={360} />
  <TweakerPanel id="build" defaultPlacement="bottom-right" theme="system" />
</TweakerProvider>
```

Omitted panel IDs default to `"default"`, so existing single-panel usage remains straightforward.

## Register Controls

Call `useTweaker(schema, { panel, section, reorderable })` inside React components. It returns `[values, setValue]`. `reorderable` defaults to `true`.

```tsx
const [values, setValue] = useTweaker(
  {
    speed: {
      defaultValue: 0.75,
      min: 0,
      max: 2,
      status: 'info',
      help: 'Adjusts preview animation speed.',
    },
    exposure: { type: 'number', defaultValue: 1, min: 0, max: 4 },
    fps: { type: 'display', defaultValue: 60, format: '{value} fps' },
    mode: { type: 'select', defaultValue: 'fast', options: ['fast', 'quality'] },
    enabled: { defaultValue: true },
  },
  {
    panel: 'scene',
    section: { id: 'rendering', label: 'Rendering' },
    reorderable: true,
  },
)
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

- Supported built-ins are numbers, sliders, selects, checkboxes, and display rows.
- Min/max numeric shorthand becomes a slider.
- Use explicit `type: "number"` for bounded number inputs.
- Use `formatOptions` on sliders when their output needs Intl formatting; default fraction digits are inferred from `step`.
- Use `type: "display"` for derived non-interactive readouts; they update from `defaultValue` on re-registration and ignore writes.
- Use `status: "info" | "alert" | "error"` on object controls for blue, amber, or red row states.
- Use `help: React.ReactNode` on object controls for row help tooltips; keep tooltip styling owned by the panel.
- Use `description: React.ReactNode` on object controls for dynamic row footer content; derive it from live values and re-register when it changes.
- Use `readOnly: true` to show a value while blocking writes.
- Use `hidden: true` on controls or sections to hide rows while preserving values and order.
- Dynamic schemas are supported; re-registration updates labels, bounds, options, formatting, read-only/hidden state, and display metadata, and it sanitizes values when numeric bounds or select options narrow.
- Pass `reorderable: false` in hook options when a hook registration should not be draggable.
- Put panel opacity and backdrop blur on `TweakerPanel.appearance`, not hook options.
- Use `width={360}` or another CSS length string on `TweakerPanel` to set `--tw-panel-width`.
- Section collapse state is persisted per panel and section.
- Reordering is panel-local and section-local and starts from the grip handle.
- The package ships dark and light CSS-variable themes. Use `theme="system"` to follow `prefers-color-scheme`, or customize further by overriding CSS variables around the panel.
- Package styles may be authored with Tailwind internally, but consumers only import compiled plain CSS from `tweaker/style.css`.
- Compatibility aliases still work: `storeId`, `placement`, `sortable`, hook-level panel effects, and `value`.
