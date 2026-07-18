# Tweaker

A compact Leva-inspired floating config panel for React. It supports named panels, number inputs, sliders, selects, checkboxes, registry-backed custom controls, section-local reordering, collapsible sections, row status states, control help tooltips, panel themes, persisted values/order, collapse state, and magnetic panel docking.

This monorepo also includes a small Vite+ React demo app and `panel` React component package used as a local workspace integration example.

Tweaker uses a provider-scoped Zustand store. Persisted values, panel-local row order, panel and section collapsed state, and dock position are written through Zustand's `persist` middleware, and data read from localStorage is validated with Zod before it reaches the store.

## Usage

```tsx
import {
  TweakerPanel,
  TweakerProvider,
  defineTweakerControl,
  mergeTweakerControls,
  useTweaker,
  type TweakerControlProps,
} from 'tweaker'
import 'tweaker/style.css'

function ColorControl({ id, value, setValue }: TweakerControlProps<string>) {
  return (
    <input
      id={id}
      type="color"
      value={typeof value === 'string' ? value : '#9bd16f'}
      onChange={(event) => setValue(event.target.value)}
    />
  )
}

export const colorControl = defineTweakerControl<string>({
  type: '@acme/color',
  component: ColorControl,
})

export const color = colorControl.config

const controls = mergeTweakerControls(colorControl)

function SceneControls() {
  const [values, setValue] = useTweaker(
    {
      speed: {
        defaultValue: 0.72,
        min: 0,
        max: 2,
        step: 0.01,
        status: 'info',
        help: 'Adjusts the preview animation speed.',
      },
      exposure: { type: 'number', defaultValue: 1, min: 0, max: 4 },
      bloom: { defaultValue: true },
      accent: color({ id: 'accent', defaultValue: '#9bd16f' }),
    },
    {
      panel: 'scene',
      section: { id: 'rendering', label: 'Rendering' },
      reorderable: true,
    },
  )

  return <button onClick={() => setValue('speed', 1.25)}>Boost</button>
}

export function App() {
  return (
    <TweakerProvider id="my-app" controls={controls}>
      <SceneControls />
      <TweakerPanel
        id="scene"
        defaultPlacement="top-right"
        theme="dark"
        width={360}
        appearance={{
          surfaceOpacity: 0.72,
          activeSurfaceOpacity: 0.95,
          backdropBlur: 0,
          activeBackdropBlur: 8,
        }}
      />
    </TweakerProvider>
  )
}
```

## Controls

- Number: `{ type: "number", defaultValue: 1, min?: 0, max?: 10, step?: 0.1, formatOptions?: Intl.NumberFormatOptions }`
- Slider shorthand: `{ defaultValue: 0.5, min: 0, max: 1 }`
- Slider explicit: `{ type: "slider", defaultValue: 0.5, min: 0, max: 1, step?: 0.01, formatOptions?: Intl.NumberFormatOptions }`
- Select: `{ type: "select", defaultValue: "green", options: ["green", "amber"] }`
- Checkbox: `{ defaultValue: true }` or `{ type: "checkbox", defaultValue: true }`
- Display: `{ type: "display", defaultValue: 42, formatOptions?: Intl.NumberFormatOptions, format?: "Total: {value}" }` — a non-interactive, non-editable row that reflects a computed/derived value. Derive it from other panel values; the display updates on re-registration. `formatOptions` formats numbers (Intl); `format` wraps the result with `{value}` substituted.
- Custom: register a control definition on `TweakerProvider.controls`, then use its `type` in a schema.

Explicit `type: "number"` wins over min/max shorthand, so bounded number inputs stay number inputs. The number input is a React Aria `NumberField`; pass `formatOptions` (`Intl.NumberFormatOptions`) to format the value with units, fraction-digit limits, currency, and more, e.g. `{ style: "unit", unit: "millimeter", unitDisplay: "short", minimumFractionDigits: 1, maximumFractionDigits: 2 }`. Slider outputs also accept `formatOptions`; their default fraction digits are inferred from `step`.

Object controls can include `status: "info" | "alert" | "error"` to tint the row blue, amber, or red with an outline and thicker left border. Add `help: React.ReactNode` to object controls to show a small row tooltip that uses the panel theme/appearance. Add `description: React.ReactNode` to render a row footer below the control; derive it from live values and re-register the schema when it should change. Set `readOnly: true` to render a control faded and greyscale and block value writes (enforced in the store); the value stays visible but non-editable. Set `hidden: true` to hide a control row while preserving its value and order slot (reversible).

Sections accept `hidden: true` on their `SectionConfig` (`useTweaker(schema, { section: { id, label, hidden } })`) to hide an entire section while preserving its controls' values and order. Like control `hidden`, it is runtime metadata (not persisted) and updates on re-registration. Pass an empty string as the `label` (`{ id, label: "" }`) to render a headerless section \u2014 no title, no collapse toggle, and the section is always expanded.

Controls are fully dynamic: derive the schema from other values/state and `useTweaker` re-registers whenever it changes, propagating new `min`/`max`/`step`/`options`/`readOnly`/`hidden`/`formatOptions`/`label`/`status`/`help`/`description`/`layout`/`height`/`minHeight` to the store and UI. When bounds or options narrow, existing values are sanitized automatically on re-registration \u2014 numbers are clamped to the new range, and select values that are no longer in `options` fall back to the default (if still valid) or the first option \u2014 so cross-control side effects (locking, hiding, re-bounding) never leave a control holding an out-of-range or invalid value.

Use `{ id, label }` sections when labels may change; `id` is the stable persistence identity. Use a control-level `id` when a schema key may change. Use `defaultValue` for control defaults.

## Extensions

Tweaker controls are trusted React components registered explicitly by the app. Core controls use the same definition API third-party controls use. No extension code is loaded unless you import it, built-ins remain bundled, and additional controls are opt-in.

Simple app-local control:

```tsx
export const colorControl = defineTweakerControl<string>({
  type: '@acme/color',
  component: ColorControl,
})

export const color = colorControl.config
```

Advanced controls can own metadata defaults, value mode, layout, normalization, sanitization, and equality:

```tsx
export const svgControl = defineTweakerControl({
  type: '@acme/svg',
  valueMode: 'display',
  layout: 'block',
  component: SvgControl,
  normalize: () => ({ height: 140 }),
})
```

Example `profileSvg` value:

```ts
const profileSvg = {
  viewBox: '-56 -56 112 112',
  paths: [
    { d: 'M -52 0 L 52 0 M 0 -52 L 0 52', stroke: '#647066', strokeWidth: 0.6 },
    {
      d: 'M 0 -42 C 24 -42 42 -24 42 0 C 42 24 24 42 0 42 C -24 42 -42 24 -42 0 C -42 -24 -24 -42 0 -42 Z',
      stroke: '#9bd16f',
      strokeWidth: 2,
      fill: 'rgba(155, 209, 111, 0.1)',
    },
  ],
}
```

`valueMode` controls persistence semantics:

- `"input"` values persist and can be written through `setValue`.
- `"display"` values derive from `defaultValue`, ignore stale persistence, and refuse writes.
- `"transient"` values can update in memory without writing to persisted `values`.

`layout` controls row geometry:

- `"inline"` matches built-in compact rows.
- `"block"` puts label/help above full-width content.
- `"full"` lets visual surfaces span the row width.

Recommended reusable package shape:

```txt
@acme/tweaker-color/
  src/index.ts
  src/ColorControl.tsx
  src/style.css
  package.json
```

Recommended exports:

```ts
export const colorControl
export const colorControls
export const color
export type ColorControlConfig
export type ColorValue
```

Recommended consumer pattern:

```tsx
import { mergeTweakerControls, TweakerPanel, TweakerProvider } from 'tweaker'
import { colorControls } from '@acme/tweaker-color'
import '@acme/tweaker-color/style.css'

const controls = mergeTweakerControls(colorControls)

<TweakerProvider id="app" controls={controls}>
  <App />
  <TweakerPanel />
</TweakerProvider>
```

Extensions should use namespaced type IDs, JSON-compatible values, React Aria or equivalent accessibility for interactive controls, and CSS imported by the consuming app. Keep extension code as ordinary trusted app code: Tweaker extensions are not a plugin loader, sandboxed remote code, a marketplace runtime, a DSL, or global registration.

## Panels

One provider can host multiple named panels. `useTweaker(..., { panel: "build" })` routes controls to `<TweakerPanel id="build" />`; omitted panel IDs use `"default"`.

Panel appearance and layout belong on `TweakerPanel`:

```tsx
<TweakerPanel
  id="build"
  title="Build"
  defaultPlacement="bottom-right"
  theme="system"
  width={360}
  appearance={{ surfaceOpacity: 0.8, activeBackdropBlur: 8 }}
/>
```

`theme` accepts `"dark"`, `"light"`, or `"system"` and defaults to `"dark"`. `width` accepts a number of pixels or any CSS length string and is applied through `--tw-panel-width`; the panel still clamps to the viewport. Portaled controls such as select popovers use the same panel theme.

`storeId`, `placement`, `sortable`, hook-level panel effects, and `value` remain compatibility aliases, but primary docs use `id`, `defaultPlacement`, `reorderable`, panel `appearance`, and `defaultValue`.

## Standalone panel package

`packages/panel` is a separate experimental composition API used by `apps/demo`. It
supports application-owned stores and custom field items:

```tsx
import { createTweakerPanelStore, TweakerItem, TweakerPanel, TweakerProvider } from 'panel'
import 'panel/style.css'

const store = createTweakerPanelStore({
  panelId: 'scene',
  initialValues: { name: 'Studio' },
})

export function Inspector() {
  return (
    <TweakerProvider theme="system" storageKey="my-app:panel-layout">
      <TweakerPanel store={store} title="Scene" defaultPlacement="top-right" width={360}>
        <TweakerItem field="name" defaultValue="Studio" label="Name">
          {(item) => (
            <input
              value={
                typeof item.fieldState?.draftValue === 'string'
                  ? item.fieldState.draftValue
                  : String(item.value ?? '')
              }
              onChange={(event) => item.setInput(event.target.value)}
            />
          )}
        </TweakerItem>
      </TweakerPanel>
    </TweakerProvider>
  )
}
```

Application writes use `store.getState().setFieldValue` or atomic `setFieldValues`.
Field items accept library-neutral synchronous `parse`/`validate` contracts, including
Standard Schema-compatible validators such as Zod. Invalid interactive candidates remain
as field drafts with errors; programmatic writes reject without mutation; imports and
reactive constraint repairs are reviewed and applied atomically.

The root `panel` entry exposes consumer components and contracts. Import low-level state
types, hooks, ordering utilities, theme constants, and normalization helpers from
`panel/advanced`. See [`packages/panel/README.md`](packages/panel/README.md) for the full
API.

## Development

```bash
pnpm install
pnpm dev
pnpm --filter tweaker test
pnpm --filter panel test
pnpm --filter demo build
pnpm --filter website test:e2e
pnpm ready
```

The demo/docs page lives in `apps/website`. The reusable Tweaker package lives in `packages/tweaker`. The standalone panel package lives in `packages/panel`, and `apps/demo` consumes it through `workspace:*`.

## Port Allocation

This workspace is registered in the `ports` registry as `tweaker` and owns the fixed local port range `6030-6039`.

Use only ports from this range for dev, preview, e2e, and testing servers:

- `6030`: `apps/website` development server and Playwright e2e web server.
- `6031`: `apps/website` preview server.
- `6032`: canonical `apps/demo` development server; override it with `DEMO_PORT` for concurrent worktrees.
- `6033`: `apps/demo` preview server.
- `6034`: dedicated `DEMO_PORT=6034` override for the `feature/panel-api-dx` worktree; this does not replace the canonical `6032` default.
- `6035-6039`: available for future apps, e2e harnesses, API mocks, and test servers.

When adding a new app or local server, assign it the next available port from `6035-6039` and document the assignment here.
