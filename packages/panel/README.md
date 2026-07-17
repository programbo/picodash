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

Pure normalization and projection helpers are exported alongside the controls for custom
composition and focused testing. Keep the panel store authoritative for user values. Use
MotionValues only for high-frequency visual sampling or smoothing, respect reduced-motion,
and commit meaningful values through `control.setValue`.

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
