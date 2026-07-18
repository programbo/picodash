# panel

A Vite+ React component library used by the local `demo` app.

## Usage

```tsx
import { FeaturePanel, type FeaturePanelItem } from 'panel'
import 'panel/style.css'

const items: FeaturePanelItem[] = [{ label: 'Build health', value: 'Passing', status: 'success' }]

export function App() {
  return <FeaturePanel title="Release Panel" items={items} />
}
```

The experimental Tweaker composition API renders panels into the provider-owned portal
container and exposes global and panel-local Zustand stores through context.

```tsx
import { TweakerPanel, TweakerProvider } from 'panel'
import 'panel/style.css'

export function App() {
  return (
    <TweakerProvider>
      <TweakerPanel id="scene" title="Scene" collapsible>
        Panel content
      </TweakerPanel>
    </TweakerProvider>
  )
}
```

Set `collapsible` to add an accessible disclosure control to the panel header. Use
`defaultCollapsed` when an opt-in panel should start closed.

Every titled `TweakerPanel` also includes an actions menu at the far end of its header.
The menu can expand or collapse all visible collapsible groups, reset registered fields,
and copy, export, or import panel values as JSON or YAML. Copy and export include
display-only fields. Reset and import only change currently registered writable fields:
order, group disclosure, panel layout, metadata, display-only values, and stale
unregistered values remain untouched.

Imported documents must be a bare object keyed by registered field ID. Unknown keys,
non-JSON-compatible values, and values whose JSON kind differs from the current/default
field value reject the whole document without a partial update. Registered display-only
keys are accepted but ignored. Missing registered writable keys reset to their defaults
(or are removed when no default exists). Successful imported values become dirty and
touched. Hidden registered writable fields participate; unregistered fields do not.
Display-only fields remain available in copied and exported documents.

`TweakerSlider` accepts `marks` for labels below the slider track:

- `marks={true}` renders min and max.
- `marks={2}` renders min, max, and two evenly distributed intermediate labels.
- `marks={[0, 0.9, 1]}` renders explicit labels at proportional positions.
- `marks={[{ value: 0.5, label: 'Mid' }]}` renders custom labels.

`TweakerSlider` and `TweakerNumber` accept `formatOptions` with
`Intl.NumberFormatOptions` for formatted display values such as units and percentages.

### Composable input gallery

The panel package also exports richer controls that compose the same `TweakerControl`
registration, state, reset, status, help, ordering, and accessibility behavior:

- `TweakerSegmented`: a string-valued Radix segmented selector whose object options accept
  an optional `icon: ReactNode` alongside their accessible label.
- `TweakerAlignment`: a fixed 3×3 visual alignment selector whose values range from
  `"top-left"` through `"bottom-right"`.
- `TweakerVector3`: a JSON-compatible `{ x, y, z }` numeric value.
- `TweakerRange`: an ordered `[low, high]` Radix range slider.
- `TweakerXYPad`: an `{ x, y }` direct-manipulation surface with keyboard support,
  point-attached coordinates, and reduced-motion-aware Motion spring smoothing.
- `TweakerGradient`: a JSON-compatible array of `{ id, color, position }` stops.
- `TweakerMediaPreview`: a read-only image/SVG URL preview; it never injects SVG markup.
- `TweakerDropzone`: a `react-dropzone` surface that stores serializable file metadata,
  never browser `File` objects; optional image previews open in a portaled, accessible
  Motion viewer.

```tsx
import {
  TweakerAlignment,
  TweakerGradient,
  TweakerPanel,
  TweakerProvider,
  TweakerRange,
  TweakerVector3,
} from 'panel'

const defaults = {
  alignment: 'center',
  gradient: [
    { id: 'start', color: '#22d3ee', position: 0 },
    { id: 'end', color: '#fb7185', position: 1 },
  ],
  range: [20, 80],
  vector: { x: 0, y: 1, z: 2 },
}

export function CustomItems() {
  return (
    <TweakerProvider>
      <TweakerPanel id="custom" title="Custom Items" defaultValues={defaults}>
        <TweakerAlignment field="alignment" label="Alignment" />
        <TweakerVector3 field="vector" label="Position" min={-10} max={10} />
        <TweakerRange field="range" label="Thresholds" min={0} max={100} />
        <TweakerGradient field="gradient" label="Ramp" />
      </TweakerPanel>
    </TweakerProvider>
  )
}
```

`TweakerControl.contentLayout` accepts `"inline"`, `"block"`, or `"full"`. Rich inputs
default to block/full layouts where appropriate while keeping descriptions in a separate
following grid row.

Controls and groups are draggable only when `reorderable` is enabled and another visible,
reorderable item exists in the same parent and `placement` band. A singleton band, or a
band whose remaining items are hidden or explicitly non-reorderable, rejects pointer and
store reorder attempts. Static top-level items omit the reorder column entirely; nested
static items retain a marker so sibling row columns remain aligned.

Pure normalization and projection helpers are exported alongside the controls for custom
composition and focused testing. Keep the panel store authoritative for user values. Use
MotionValues only for high-frequency visual sampling or smoothing, respect reduced-motion,
and commit meaningful values through `control.setValue`.

## Design tokens and themes

`TweakerProvider`, `TweakerPanel`, and `FeaturePanel` accept `theme?: string`.
Resolution is panel override, then provider theme, then `"dark"`. `FeaturePanel` inherits
the nearest Tweaker theme or defaults to dark. `useTweakerTheme()` returns the resolved
name for custom controls that create portals.

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
