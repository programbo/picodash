# Tweaker

A compact Leva-inspired floating config panel for React. It supports number inputs, sliders, selects, checkboxes, section-local reordering, persisted values/order, collapse state, and magnetic panel docking.

## Usage

```tsx
import { TweakerPanel, TweakerProvider, useTweaker } from "tweaker";
import "tweaker/style.css";

function SceneControls() {
  const [values, setValue] = useTweaker(
    {
      speed: { value: 0.72, min: 0, max: 2, step: 0.01 },
      exposure: { type: "number", value: 1, min: 0, max: 4 },
      bloom: { value: true },
      tint: {
        type: "select",
        value: "green",
        options: ["green", "amber", "blue"],
      },
    },
    { section: "Rendering", sortable: true },
  );

  return <button onClick={() => setValue("speed", 1.25)}>Boost</button>;
}

export function App() {
  return (
    <TweakerProvider storeId="my-app">
      <SceneControls />
      <TweakerPanel placement="top-right" />
    </TweakerProvider>
  );
}
```

## Controls

- Number: `{ type: "number", value: 1, min?: 0, max?: 10, step?: 0.1 }`
- Slider shorthand: `{ value: 0.5, min: 0, max: 1 }`
- Slider explicit: `{ type: "slider", value: 0.5, min: 0, max: 1 }`
- Select: `{ type: "select", value: "green", options: ["green", "amber"] }`
- Checkbox: `{ value: true }` or `{ type: "checkbox", value: true }`

Explicit `type: "number"` wins over min/max shorthand, so bounded number inputs stay number inputs.

Pass `sortable: false` in the hook options to keep a registration fixed in place:

```tsx
useTweaker(
  { channel: { type: "select", value: "stable", options: ["stable"] } },
  {
    section: "Build",
    sortable: false,
  },
);
```

## Development

```bash
pnpm install
pnpm dev
pnpm --filter tweaker test
pnpm --filter website test:e2e
pnpm ready
```

The demo/docs page lives in `apps/website`. The reusable package lives in `packages/tweaker`.
