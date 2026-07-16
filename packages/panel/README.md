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

## Development

```bash
vp install
vp test
vp pack
```
