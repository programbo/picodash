---
name: picodash
description: Use the promoted Picodash package with application-owned stores and composable panels.
---

# Picodash Package Usage

This workspace uses the promoted `@picodash/panel` API only.

The workspace website serves the canonical interactive control gallery at `/` (Next app routes listed below),
with `/state-lab` and `/panel-geometry-lab` reserved for debugging workflows.
Deprecated `apps/website` retains its root gallery route (`/`) plus debugging-only `/state-lab` and
`/panel-geometry-lab`; no compatibility routes are maintained.
`/demo` is deprecated legacy and is not an active route or API surface.

## Preferred Imports

```tsx
import {
  createPicodashPanelStore,
  PicodashItem,
  PicodashPanel,
  PicodashProvider,
  usePicodashPanelStoreSelector,
} from '@picodash/panel'
import '@picodash/panel/style.css'
```

Use package-owned shadcn components through `@picodash/panel/ui` rather than adding another generated copy
to a consuming workspace. This surface uses React Aria prop and state conventions.

## Quick Start Pattern

1. Create a stable store once.

```ts
import { createPicodashPanelStore } from '@picodash/panel'

export const settingsStore = createPicodashPanelStore({
  panelId: 'settings',
  initialValues: {
    quality: 'balanced',
    showGrid: true,
    exposure: 1,
  },
})
```

2. Read values with selectors inside the component that consumes them.

3. Render `PicodashProvider` and `PicodashPanel`.

```tsx
import {
  PicodashPanel,
  PicodashProvider,
  PicodashSwitch,
  usePicodashPanelStoreSelector,
} from '@picodash/panel'
import { settingsStore } from './settings-store'

export function SiteControls() {
  const exposure = usePicodashPanelStoreSelector(settingsStore, (state) => {
    return typeof state.values.exposure === 'number' ? state.values.exposure : 1
  })

  return (
    <PicodashProvider theme="system" persistLayout storageKey="my-site:tweaker-layout:v1">
      <main style={{ opacity: exposure }}>App content</main>

      <PicodashPanel store={settingsStore} title="Settings" defaultPlacement="top-right">
        <PicodashSwitch field="showGrid" label="Show grid" defaultValue />
      </PicodashPanel>
    </PicodashProvider>
  )
}
```

## API Expectations

- Use `createPicodashPanelStore` for application-owned state.
- Use `PicodashPanel` with `store` for app-owned modes.
- Use `usePicodashPanel(panelId)` beneath `PicodashProvider` for reactive visibility and imperative
  `show`, `hide`, `toggle`, `setVisible`, show-and-raise `activate`, and `setPlacement` behavior.
  The controller's reactive `placement` reports floating, magnetic, or fixed state.
- Use `defaultVisible={false}` for an initially hidden but registered panel; visibility is not
  persisted with layout.
- Use `close` for a provider-managed hide button, or `close={{ behavior: 'deregister' }}` when the
  host will unmount after the provider removes the registration and portal. `onClose` is an
  optional observer and does not replace the default close behavior.
- Use `setFieldValue` / `setFieldValues` for strict app writes.
- Use `setFieldInput` for interactive editors that should retain transient drafts.
- Use `PicodashItem`, `PicodashGroup`, and built-in items for custom compositions.
- Use `@picodash/panel/advanced` only when a task needs focused provider state through
  `usePicodashProviderSelector`, imperative provider access through `usePicodashProviderStoreApi`, or
  contextual panel access through `usePicodashPanelSelector` / `usePicodashPanelStoreApi`.
- Use `@picodash/panel/ui` for shared `aria-rhea` Button, Card, Tabs, overlay, and form primitives.
- Do not use `usePicodashPanel(panelId)` to discover panel values. Panel data remains owned by the
  store passed to `PicodashPanel`.
- Preserve corner strings for legacy `defaultPlacement` usage. Use the placement object for new
  magnetic or fixed declarations, for example
  `defaultPlacement={{ mode: 'fixed', position: 'right' }}`. The magnetic edge type is
  `PicodashPanelSnapPosition`; do not reintroduce the old dock-position name.
- Prefer `PicodashProvider panelBoundary={mainRef}` when all panels share an application surface.
  Use `PicodashPanel boundary={canvasRef}` only for a panel-specific surface, and
  `boundary={null}` to explicitly restore viewport bounds. Accept Elements and React refs, not CSS
  selector strings.
- Keep `portalContainer` and boundaries conceptually separate: the portal chooses render
  ownership, while the boundary constrains floating, snapping, fixed docking, and collapse-toggle
  geometry.
- Fixed `left` and `right` placements fill the effective boundary height. Start/end pinned lanes
  remain visible while only the auto lane scrolls. Every root scrollport receives the bundled
  `scroll-fade` utility from `@picodash/panel/style.css`.

## Validation and State

- Use synchronous `parse` and `validate`; no promise-based contracts.
- Hoist custom parser and validator functions or stabilize them with `useCallback`.
- Values must be JSON-compatible.
- `setFieldValues` is atomic and rejects invalid batches.
- Handle async sparkline failures with `onSourceError`.

## Framework and Accessibility Notes

- In Next.js App Router projects, add `'use client'` to modules that render Picodash components.
- Reorder with Space/Enter, Arrow Up/Down, and Escape as well as pointer dragging.

## Migration Note

This repository is on the promoted API. Legacy schema-driven registration and old persistence are not migrated.

## Workspace App Surfaces

- `apps/web` (Next.js): canonical route-based showcase app, started with `bun run web`.
- `apps/website` (Vite): deprecated showcase app, started with `bun run website`.

`apps/web` route topology:

- `/`, `/store`, `/usage`, `/more-examples`
- `/state-lab/provider`, `/state-lab/scene`, `/state-lab/built-in-items`, `/state-lab/custom-items` (debugging-only)
- `/panel-geometry-lab` (debugging-only) and not-found fallback.

`apps/website` route subset:

- `/`, `/state-lab` (debugging-only), `/panel-geometry-lab` (debugging-only), and not-found fallback.

## Local Development

- `bun install`
- `bun run dev`
- `bun run website`
- `bun run web`
- `bun run --filter @picodash/panel check`
- `bun run --filter @picodash/panel test`
- `bun run --filter website test:e2e`
- `bun run --filter @picodash/web check`
- `bun run --filter @picodash/web test:e2e`
- `bun audit --audit-level=high`
- `bun run --cwd packages/panel release:check`
- `bun run ready`

Focused validation:

- `vp run @picodash/panel#build` before workspace-wide checks or builds.
- `WEBSITE_PORT=6035 bun run web`
- `WEBSITE_PORT=6035 bun run --filter @picodash/web test:e2e`
- `WEBSITE_PORT=6035 bun run website`
- `WEBSITE_PORT=6035 bun run --filter website test:e2e`

GitHub CI runs parallel quality and E2E jobs for pull requests and pushes to `main`.
