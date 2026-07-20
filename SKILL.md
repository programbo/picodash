---
name: tweaker
description: Use the promoted Tweaker package with application-owned stores and composable panels.
---

# Tweaker Package Usage

This workspace uses the promoted `tweaker` API only.

The workspace website serves the interactive control gallery at `/` and the live store inspector at `/state-lab`.

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

2. Read values with selectors inside the component that consumes them.

3. Render `TweakerProvider` and `TweakerPanel`.

```tsx
import { TweakerPanel, TweakerProvider, TweakerSwitch, useTweakerPanelStoreSelector } from 'tweaker'
import { settingsStore } from './settings-store'

export function SiteControls() {
  const exposure = useTweakerPanelStoreSelector(settingsStore, (state) => {
    return typeof state.values.exposure === 'number' ? state.values.exposure : 1
  })

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
- Use `useTweakerPanel(panelId)` beneath `TweakerProvider` for reactive visibility and imperative
  `show`, `hide`, `toggle`, `setVisible`, or show-and-raise `activate` behavior.
- Use `defaultVisible={false}` for an initially hidden but registered panel; visibility is not
  persisted with layout.
- Use `close` for a provider-managed hide button, or `close={{ behavior: 'deregister' }}` when the
  host will unmount after the provider removes the registration and portal. `onClose` is an
  optional observer and does not replace the default close behavior.
- Use `setFieldValue` / `setFieldValues` for strict app writes.
- Use `setFieldInput` for interactive editors that should retain transient drafts.
- Use `TweakerItem`, `TweakerGroup`, and built-in items for custom compositions.
- Use `tweaker/advanced` only when a task needs internals.

## Validation and State

- Use synchronous `parse` and `validate`; no promise-based contracts.
- Hoist custom parser and validator functions or stabilize them with `useCallback`.
- Values must be JSON-compatible.
- `setFieldValues` is atomic and rejects invalid batches.
- Handle async sparkline failures with `onSourceError`.

## Framework and Accessibility Notes

- In Next.js App Router projects, add `'use client'` to modules that render Tweaker components.
- Reorder with Space/Enter, Arrow Up/Down, and Escape as well as pointer dragging.

## Migration Note

This repository is on the promoted API. Legacy schema-driven `useTweaker` and old persistence are not migrated.

## Local Development

- `bun install`
- `bun run dev`
- `bun run website`
- `bun run --filter tweaker check`
- `bun run --filter tweaker test`
- `bun run --filter website test:e2e`
- `bun audit --audit-level=high`
- `bun run ready`
