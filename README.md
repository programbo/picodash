# Tweaker

A compact Leva-inspired floating config panel for React. It supports named panels, number inputs, sliders, selects, checkboxes, registry-backed custom controls, section-local reordering, row status states, control help tooltips, panel themes, persisted values/order, collapse state, and magnetic panel docking.

Tweaker uses a provider-scoped Zustand store. Persisted values, panel-local row order, collapsed state, and dock position are written through Zustand's `persist` middleware, and data read from localStorage is validated with Zod before it reaches the store.

## Usage

```tsx
import { TweakerPanel, TweakerProvider, useTweaker, type TweakerCustomControlProps } from "tweaker";
import "tweaker/style.css";

function ColorControl({ id, value, setValue }: TweakerCustomControlProps) {
  return (
    <input
      id={id}
      type="color"
      value={typeof value === "string" ? value : "#9bd16f"}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

function SceneControls() {
  const [values, setValue] = useTweaker(
    {
      speed: {
        defaultValue: 0.72,
        min: 0,
        max: 2,
        step: 0.01,
        status: "info",
        help: "Adjusts the preview animation speed.",
      },
      exposure: { type: "number", defaultValue: 1, min: 0, max: 4 },
      bloom: { defaultValue: true },
      accent: { type: "color", id: "accent", defaultValue: "#9bd16f" },
    },
    {
      panel: "scene",
      section: { id: "rendering", label: "Rendering" },
      reorderable: true,
    },
  );

  return <button onClick={() => setValue("speed", 1.25)}>Boost</button>;
}

export function App() {
  return (
    <TweakerProvider id="my-app" controls={{ color: ColorControl }}>
      <SceneControls />
      <TweakerPanel
        id="scene"
        defaultPlacement="top-right"
        theme="dark"
        appearance={{
          surfaceOpacity: 0.72,
          activeSurfaceOpacity: 0.95,
          backdropBlur: 0,
          activeBackdropBlur: 8,
        }}
      />
    </TweakerProvider>
  );
}
```

## Controls

- Number: `{ type: "number", defaultValue: 1, min?: 0, max?: 10, step?: 0.1 }`
- Slider shorthand: `{ defaultValue: 0.5, min: 0, max: 1 }`
- Slider explicit: `{ type: "slider", defaultValue: 0.5, min: 0, max: 1 }`
- Select: `{ type: "select", defaultValue: "green", options: ["green", "amber"] }`
- Checkbox: `{ defaultValue: true }` or `{ type: "checkbox", defaultValue: true }`
- Custom: register a component on `TweakerProvider.controls`, then use its `type` in a schema.

Explicit `type: "number"` wins over min/max shorthand, so bounded number inputs stay number inputs.

Object controls can include `status: "info" | "alert" | "error"` to tint the row blue, amber, or red with an outline and thicker left border. Add `help: "..."` to object controls to show a small row tooltip; help text is string metadata and uses the panel theme/appearance.

Use `{ id, label }` sections when labels may change; `id` is the stable persistence identity. Use a control-level `id` when a schema key may change. Primitive string shorthand and the old `value` spelling still work for compatibility, but new code should use explicit selects and `defaultValue`.

## Panels

One provider can host multiple named panels. `useTweaker(..., { panel: "build" })` routes controls to `<TweakerPanel id="build" />`; omitted panel IDs use `"default"`.

Panel appearance and layout belong on `TweakerPanel`:

```tsx
<TweakerPanel
  id="build"
  title="Build"
  defaultPlacement="bottom-right"
  theme="system"
  appearance={{ surfaceOpacity: 0.8, activeBackdropBlur: 8 }}
/>
```

`theme` accepts `"dark"`, `"light"`, or `"system"` and defaults to `"dark"`. Portaled controls such as select popovers use the same panel theme.

`storeId`, `placement`, `sortable`, hook-level panel effects, and `value` remain compatibility aliases, but primary docs use `id`, `defaultPlacement`, `reorderable`, panel `appearance`, and `defaultValue`.

## Development

```bash
pnpm install
pnpm dev
pnpm --filter tweaker test
pnpm --filter website test:e2e
pnpm ready
```

The demo/docs page lives in `apps/website`. The reusable package lives in `packages/tweaker`.

## Port Allocation

This workspace is registered in the `ports` registry as `tweaker` and owns the fixed local port range `6030-6039`.

Use only ports from this range for dev, preview, e2e, and testing servers:

- `6030`: `apps/website` development server and Playwright e2e web server.
- `6031`: `apps/website` preview server.
- `6032-6039`: available for future apps, e2e harnesses, API mocks, and test servers.

When adding a new app or local server, assign it the next available port from `6032-6039` and document the assignment here.
