# panel

A Vite+ React component library used by the local `demo` app.

## Usage

```tsx
import { FeaturePanel, type FeaturePanelItem } from 'panel'

const items: FeaturePanelItem[] = [{ label: 'Build health', value: 'Passing', status: 'success' }]

export function App() {
  return <FeaturePanel title="Release Panel" items={items} />
}
```

## Development

```bash
vp install
vp test
vp pack
```
