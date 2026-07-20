---
name: tweaker
description: Use the promoted Tweaker package with application-owned stores and composable panels.
---

# Tweaker Package Usage

This workspace uses the promoted `tweaker` API only.

## Preferred Imports

```tsx
import {
  createTweakerPanelStore,
  TweakerItem,
  TweakerPanel,
  TweakerProvider,
  useTweakerPanelStoreSelector,
} from 'tweaker'
import 'tweaker/style.css'
```

## Quick Start Pattern

1. Create a stable store once.

```ts
import { createTweakerPanelStore } from 'tweaker'

export const settingsStore = createTweakerPanelStore({
  panelId: 'settings',
  initialValues: {
    quality: 'balanced',
    showGrid: true,
    exposure: 1,
  },
})
```

2. Read values with selectors.

```ts
import { useTweakerPanelStoreSelector } from 'tweaker'

const exposure = useTweakerPanelStoreSelector(settingsStore, (state) => {
  return typeof state.values.exposure === 'number' ? state.values.exposure : 1
})
```

3. Render `TweakerProvider` and `TweakerPanel`.

```tsx
import { TweakerPanel, TweakerProvider, TweakerSwitch, useTweakerPanelStoreSelector } from 'tweaker'

export function SiteControls() {
  return (
    <TweakerProvider theme="system" persistLayout storageKey="my-site:tweaker-layout:v1">
      <main style={{ opacity: exposure }}>App content</main>

      <TweakerPanel store={settingsStore} title="Settings" defaultPlacement="top-right">
        <TweakerSwitch field="showGrid" label="Show grid" defaultValue />
      </TweakerPanel>
    </TweakerProvider>
  )
}
```

## API Expectations

- Use `createTweakerPanelStore` for application-owned state.
- Use `TweakerPanel` with `store` for app-owned modes.
- Use `setFieldValue` / `setFieldValues` for strict app writes.
- Use `setFieldInput` for interactive editors that should retain transient drafts.
- Use `TweakerItem`, `TweakerGroup`, and built-in items for custom compositions.
- Use `tweaker/advanced` only when a task needs internals.

## Validation and State

- Use synchronous `parse` and `validate`; no promise-based contracts.
- Values must be JSON-compatible.
- `setFieldValues` is atomic and rejects invalid batches.

## Migration Note

This repository is on the promoted API. Legacy schema-driven `useTweaker` and old persistence are not migrated.

## Local Development

- `bun install`
- `bun run dev`
- `bun run website`
- `bun run --filter tweaker check`
- `bun run --filter tweaker test`
- `bun run --filter website test:e2e`
- `bun run ready`
