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

`panel/style.css` owns a three-level token hierarchy:

1. Foundation tokens (`--tweaker-palette-*`, `--tweaker-space-*`,
   `--tweaker-radius-*`, typography, opacity, borders, shadows, timing, blur, and layers)
   are the raw scales.
2. Semantic tokens (`--tweaker-color-*`) describe canvas, surfaces, text, borders,
   controls, focus, accent, and success/info/warning/alert/danger states.
3. Component contracts (`--tweaker-panel-*`, `--tweaker-row-*`,
   `--tweaker-slider-*`, `--tweaker-dropzone-*`, and related families) are the
   narrowest overrides.

Override semantic tokens for a cohesive theme, or a component token for a focused change.
Load overrides after `panel/style.css`:

```css
[data-tweaker-theme='dark'] {
  --tweaker-color-accent: oklch(0.78 0.15 172);
  --tweaker-color-accent-text: oklch(0.16 0.02 172);
  --tweaker-panel-background: oklch(0.19 0.015 250);
  --tweaker-row-hover: oklch(0.3 0.025 250 / 70%);
  --tweaker-tooltip-background: oklch(0.24 0.018 250);
  --tweaker-viewer-overlay: oklch(0 0 0 / 90%);
}
```

`TweakerProvider` carries `data-tweaker-theme="dark"` on its portal container.
Portaled panels, menus, alert dialogs, tooltips, and the dropzone image viewer repeat the
carrier so the same selector themes content even when Radix mounts it outside the provider
DOM subtree. The package never adds a host `.dark` class.

The stylesheet also exposes namespaced Tailwind utilities such as
`bg-tweaker-surface`, `text-tweaker-muted`, `border-tweaker-control`,
`ring-tweaker-focus`, `rounded-tweaker-sm`, and `shadow-tweaker-panel`. These are
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
