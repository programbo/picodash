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
      <TweakerPanel id="scene">Panel content</TweakerPanel>
    </TweakerProvider>
  )
}
```

## Development

```bash
vp install
vp test
vp pack
```
