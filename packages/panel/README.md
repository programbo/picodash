# panel

A composable React inspector-panel library. It provides an accessible floating panel,
application-owned Zustand stores, built-in JSON-compatible inputs, custom items, and
atomic import/export workflows.

## Quick start

```tsx
import {
  createTweakerPanelStore,
  TweakerPanel,
  TweakerProvider,
  TweakerSlider,
  useTweakerPanelStoreSelector,
} from 'panel'
import 'panel/style.css'

const sceneStore = createTweakerPanelStore({
  panelId: 'scene',
  initialValues: { opacity: 0.5 },
})

export function App() {
  const opacity = useTweakerPanelStoreSelector(sceneStore, (state) => state.values.opacity)

  return (
    <TweakerProvider theme="system">
      <p>Opacity: {String(opacity)}</p>
      <TweakerPanel store={sceneStore} title="Scene" width={360}>
        <TweakerSlider
          defaultValue={0.5}
          field="opacity"
          label="Opacity"
          min={0}
          max={1}
          step={0.01}
        />
      </TweakerPanel>
    </TweakerProvider>
  )
}
```

`TweakerPanel` can instead create its own store:

```tsx
<TweakerPanel
  id="scene"
  initialValues={{ opacity: 0.5 }}
  initialMeta={{ canEdit: true }}
  title="Scene"
/>
```

Internal-store mode requires `id` and accepts `initialValues` and `initialMeta`.
Application-owned mode requires `store`; initialization belongs to
`createTweakerPanelStore`, so those props are unavailable.

## Application-owned state

The panel store is a vanilla Zustand store. Read it in React with
`useTweakerPanelStoreSelector` or use its API from application code:

```ts
sceneStore.getState().setFieldValue('opacity', 0.8)

const result = sceneStore.getState().setFieldValues({
  opacity: 0.65,
  quality: 'final',
})

if (!result.success) console.error(result.errors)
```

`setFieldValue` and `setFieldValues` are strict. They parse and validate the complete
write before changing anything, and a batch commits in one Zustand transaction.
`setFieldInput` is the interactive path used by editors: invalid input is retained in
`fieldState.draftValue` with `fieldState.errors`, while the canonical value remains
unchanged.

`initialValues` seed application state once. An item's `defaultValue` is its reset
baseline; changing a default changes the next reset without overwriting the accepted
value. Successful reset reparses the latest default and clears its draft, errors, dirty,
and touched state.

## Items and groups

`TweakerItem` is the shared shell for built-in and application-defined items. A writable
item requires `field`; its `id` defaults to the field. A display-only item without a
field requires an `id`. Item IDs must be unique across the panel.

```tsx
<TweakerGroup id="rendering" label="Rendering" pin="start">
  <TweakerSlider field="exposure" label="Exposure" min={-2} max={2} />
</TweakerGroup>

<TweakerItem id="frame-chart" contentLayout="block" label="Frame time">
  <FrameChart />
</TweakerItem>
```

Use `pin="start"` or `pin="end"` to keep an item in the corresponding ordering band.
Unpinned items remain in normal flow. Items are draggable only when `reorderable` is
enabled and another visible, reorderable sibling exists in the same parent and pin band.

`contentLayout` accepts `"inline"`, `"block"`, or `"full"`. The custom-item render
function receives the canonical `value`, `fieldState`, `setInput`, input/error IDs,
disabled/read-only state, and `resetValue`.

```tsx
<TweakerItem<string> field="name" defaultValue="Studio" label="Preset name" contentLayout="block">
  {(item) => (
    <input
      id={item.inputId}
      value={
        typeof item.fieldState?.draftValue === 'string'
          ? item.fieldState.draftValue
          : (item.value ?? '')
      }
      aria-invalid={Boolean(item.fieldState?.errors.length)}
      aria-describedby={item.fieldState?.errors.length ? item.errorId : undefined}
      onChange={(event) => item.setInput(event.target.value)}
    />
  )}
</TweakerItem>
```

## Parsing and validation

Field-backed items accept synchronous, library-neutral `parse` and `validate` contracts.
`validate` also accepts a [Standard Schema v1](https://standardschema.dev/) validator, so
Zod works directly:

```tsx
import { z } from 'zod'

const presetName = z.string().trim().min(3).max(24)

<TweakerItem
  field="presetName"
  defaultValue="Studio"
  validate={presetName}
>
  {/* editor */}
</TweakerItem>
```

A parser returns a canonical value, explicit `{ unset: true }`, or errors with an
optional repair:

```ts
const parsePercent = (input: unknown) => {
  const value = typeof input === 'string' ? Number(input) : input
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { success: false, errors: ['Expected a finite percentage.'] }
  }
  return {
    success: true,
    output: { value: Math.min(100, Math.max(0, value)) },
  }
}
```

Parsing runs before validation, and successful Standard Schema output is canonical.
Promise-returning contracts are rejected: asynchronous validation is intentionally not
supported. If several mounted items share a field, all their validators run, errors are
combined, and their parser outputs must agree.

Interactive invalid edits retain a draft and accessible errors. Programmatic invalid
writes do not mutate the store. Imports validate the complete prospective document
atomically. A repairable import or reactive constraint change opens a review dialog;
Accept revalidates and commits once, while Abort preserves the accepted value. Hidden
writable fields participate in import/reset. Display fields are included in copy/export
but cannot be changed by import, reset, or writes.

## Built-in items

- `TweakerNumber`, `TweakerSlider`, `TweakerSwitch`, and `TweakerSelect`
- `TweakerSegmented` and the fixed 3x3 `TweakerAlignment`
- `TweakerVector3`, `TweakerRange`, and `TweakerXYPad`
- `TweakerGradient`
- `TweakerMediaPreview` and `TweakerDropzone`
- `TweakerDisplay` for derived, non-writable output

Composite values remain JSON-compatible. Dropzones store file metadata rather than
`File` objects; media previews use safe image URLs; object URLs are revoked when removed
or unmounted. Reactive bounds/options are part of each built-in field contract, so the
same rules apply to editing, application writes, imports, defaults, resets, and
constraint changes.

`TweakerSlider.marks` accepts `true`, a count of intermediate marks, explicit numbers, or
`{ value, label }` objects. Number and slider items accept
`Intl.NumberFormatOptions` through `formatOptions`.

## Provider and panel configuration

`TweakerProvider` owns cross-panel concerns:

- `theme`: a named theme, including `"dark"` and `"light"`; `"system"` tracks the current
  color-scheme preference; default `"dark"`
- `portalContainer`: optional host element for all portaled surfaces
- `persistLayout`: whether panel layout uses local storage; default `true`
- `storageKey`: application-specific layout persistence key

`TweakerPanel` owns panel geometry:

- `defaultPlacement`: `"top-right"`, `"top-left"`, `"bottom-right"`, or `"bottom-left"`
- `width`: pixels or a CSS length
- `collapsible` and `defaultCollapsed`

Every titled panel provides actions to expand/collapse groups, reset fields, and copy,
export, or import JSON/YAML values.

## Exports

The `panel` root exposes consumer components, their value/prop types, validation
contracts, `createTweakerPanelStore`, and selector hooks. Low-level provider/panel hooks,
registration and state types, ordering helpers, storage/theme constants, and pure
normalization/projection helpers live at `panel/advanced`:

```ts
import { TweakerItem, TweakerPanel } from 'panel'
import { normalizeRangeValue, type TweakerPanelState } from 'panel/advanced'
```

There are no `TweakerControl`, `TweakerField`, `fieldId`, `placement`, or panel
`defaultValues` compatibility exports.

## Themes

`TweakerProvider`, `TweakerPanel`, and `FeaturePanel` accept `theme?: string`.
Resolution is panel override, then provider theme, then `"dark"`. `FeaturePanel` inherits
the nearest Tweaker theme or defaults to dark. The reserved provider value `"system"`
tracks the current dark/light preference. `useTweakerTheme()` returns the resolved name
for custom controls that create portals.

Every carrier uses `data-tweaker-theme="<name>"`. Defaults are declared with
`:where([data-tweaker-theme])`, so a named consumer selector loaded after
`panel/style.css` can override the cohesive semantic contract. Provider children sit
inside a `display: contents` carrier, so consumer markup receives the same variables
without adding a layout box:

```css
[data-tweaker-theme='ocean'] {
  color-scheme: dark;
  --tweaker-color-canvas: oklch(0.16 0.025 225);
  --tweaker-color-surface: oklch(0.23 0.035 225);
  --tweaker-color-surface-raised: oklch(0.28 0.04 225);
  --tweaker-color-surface-muted: oklch(0.34 0.045 225);
  --tweaker-color-text: oklch(0.96 0.015 210);
  --tweaker-color-text-strong: oklch(1 0 0);
  --tweaker-color-text-muted: oklch(0.76 0.035 215);
  --tweaker-color-border: oklch(0.72 0.05 215 / 30%);
  --tweaker-color-control: oklch(0.72 0.05 215 / 42%);
  --tweaker-color-focus: oklch(0.82 0.13 205);
  --tweaker-color-accent: oklch(0.82 0.13 205);
  --tweaker-color-accent-text: oklch(0.16 0.025 225);
  --tweaker-color-success: oklch(0.78 0.17 165);
  --tweaker-color-info: oklch(0.78 0.15 225);
  --tweaker-color-warning: oklch(0.84 0.18 85);
  --tweaker-color-alert: oklch(0.76 0.18 55);
  --tweaker-color-danger: oklch(0.71 0.19 24);
  --tweaker-color-overlay: oklch(0 0 0 / 85%);
}
```

Surface hover, wells, muted borders, state tints, feature-panel colors, and viewer colors
are derived from those core roles. Select popovers, action menus and submenus, alert-dialog
overlays and content, tooltips, and the media viewer repeat the resolved carrier even when
Radix mounts them outside the provider subtree. The package never adds a host `.dark`
class.

```tsx
<TweakerProvider theme="ocean">
  <TweakerPanel id="scene" title="Scene">
    {/* inherits ocean */}
  </TweakerPanel>
  <TweakerPanel id="output" title="Output" theme="plum">
    {/* explicit override; its portals are plum too */}
  </TweakerPanel>
</TweakerProvider>
```

The complete optional public system contract is:

- Spacing: `--tweaker-space-0-5`, `--tweaker-space-1`, `--tweaker-space-1-5`,
  `--tweaker-space-2`, `--tweaker-space-2-5`, `--tweaker-space-3`,
  `--tweaker-space-4`, `--tweaker-space-5`.
- Geometry: `--tweaker-radius-surface`, `--tweaker-radius-control`,
  `--tweaker-control-height-xs`, `--tweaker-control-height-sm`,
  `--tweaker-control-height-md`, `--tweaker-control-height-lg`,
  `--tweaker-field-surface-min-height`.
- Icons: `--tweaker-icon-xs`, `--tweaker-icon-sm`, `--tweaker-icon-md`,
  `--tweaker-icon-lg`.
- Typography: `--tweaker-font-family`, `--tweaker-font-size-xs`,
  `--tweaker-font-size-sm`, `--tweaker-font-size-md`, `--tweaker-font-size-lg`,
  `--tweaker-font-size-xl`, `--tweaker-font-size-2xl`, `--tweaker-font-size-3xl`,
  `--tweaker-line-tight`, `--tweaker-line-normal`, `--tweaker-line-relaxed`,
  `--tweaker-font-light`, `--tweaker-font-normal`, `--tweaker-font-medium`,
  `--tweaker-font-semibold`, `--tweaker-tracking-normal`, `--tweaker-tracking-wide`.
- Effects: `--tweaker-opacity-disabled`, `--tweaker-opacity-disabled-soft`,
  `--tweaker-opacity-muted`, `--tweaker-opacity-subtle`, `--tweaker-border-thin`,
  `--tweaker-shadow-sm`, `--tweaker-shadow-md`, `--tweaker-shadow-panel`,
  `--tweaker-shadow-viewer`, `--tweaker-shadow-inner`, `--tweaker-duration-fast`,
  `--tweaker-ease-out`, `--tweaker-blur-surface`, `--tweaker-blur-overlay`.
- Host integration: `--tweaker-layer-raised`, `--tweaker-layer-drag`,
  `--tweaker-layer-tooltip`, `--tweaker-layer-select`, `--tweaker-layer-menu`,
  `--tweaker-layer-dialog`, `--tweaker-layer-viewer`, `--tweaker-panel-width`.
- Core colors: `--tweaker-color-canvas`, `--tweaker-color-surface`,
  `--tweaker-color-surface-raised`, `--tweaker-color-surface-muted`,
  `--tweaker-color-text`, `--tweaker-color-text-strong`,
  `--tweaker-color-text-muted`, `--tweaker-color-border`,
  `--tweaker-color-control`, `--tweaker-color-focus`, `--tweaker-color-accent`,
  `--tweaker-color-accent-text`, `--tweaker-color-success`, `--tweaker-color-info`,
  `--tweaker-color-warning`, `--tweaker-color-alert`, `--tweaker-color-danger`,
  `--tweaker-color-overlay`.

Variables prefixed `--_tweaker-` are private derived formulas and browser geometry; do not
override them. Component-family theme variables are intentionally not part of the contract.

The stylesheet also exposes namespaced Tailwind utilities such as
`bg-tweaker-surface`, `text-tweaker-muted`, `border-tweaker-control`,
`ring-tweaker-focus`, `rounded-tweaker-surface`, and `shadow-tweaker-panel`. These are
convenient for custom items when the consumer's Tailwind build scans the package source.
Raw `--tweaker-*` variables are the reliable public theming surface in every setup:

```tsx
<div className="bg-(--tweaker-color-surface-muted) text-(--tweaker-color-text)">
  Custom panel item
</div>
```

CSS remains the source of truth for editable visual values, including the viewer layer
through `--tweaker-layer-viewer`. The exported `tweakerMotionTokens` object centralizes
JS-only Motion springs and visual states, `tweakerGeometryTokens` holds numeric geometry
needed by projection math, and `tweakerLayerTokens` holds the JS-only panel layer base.
`tweakerThemeAttribute` and `tweakerDefaultTheme` expose the carrier contract.

The official shadcn/Recharts and live MotionValue examples live in `apps/demo` rather than
the publishable package. The chart style generator receives application-authored trusted
configuration only; media URLs, dropped files, and SVG input never flow into its CSS.

## Development

```bash
vp install
vp test
vp pack
pnpm --filter demo test:e2e
```

The demo defaults to port `6032`. For the API/DX worktree, run it on the reserved
worktree port without changing the canonical default:

```bash
DEMO_PORT=6034 pnpm --filter demo dev
DEMO_PORT=6034 pnpm --filter demo test:e2e
```
