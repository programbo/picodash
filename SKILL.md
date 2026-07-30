---
name: picodash
description: Use the promoted Picodash package with application-owned stores and composable panels.
---

# Picodash Package Usage

This workspace uses the promoted `@picodash/panel` API and `@picodash/store` as the typed panel
state foundation.

The production website serves the canonical interactive control home at `/`. A separate local-only
app exposes debugging workflows under `/lab/*`; those routes are not deployed with the website.
Legacy web routes are compatibility surfaces, and the active `/apps/web` surface follows the current
topology below.

Canonical references:

- [PRODUCT.md](PRODUCT.md)
- [CONTEXT.md](CONTEXT.md)
- [TESTING.md](TESTING.md)
- [agent-first-plan.md](agent-first-plan.md)

## Preferred Imports

```tsx
import { PicodashItem, PicodashPanel, PicodashProvider } from '@picodash/panel'
import { createPicodashStore } from '@picodash/store'
import { usePicodashStoreSelector } from '@picodash/store/react'
import '@picodash/panel/style.css'
```

Use package-owned shadcn components through `@picodash/panel/ui` rather than adding another generated copy
to a consuming workspace. This surface uses React Aria prop and state conventions.

Use `@picodash/panel/dashlet` for compound panel shells (`Frame`, `Body`, `Toolbar`, and related stateful
structures), and reserve `/ui` for low-level controls and primitives.

## Quick Start Pattern

1. Create a stable store once.

```ts
import { createPicodashStore } from '@picodash/store'

export const settingsStore = createPicodashStore({
  panelId: 'settings',
  fields: {
    quality: { defaultValue: 'balanced' },
    showGrid: { defaultValue: true },
    exposure: { defaultValue: 1 },
  }
})
```

2. Read values with selectors inside the component that consumes them.

3. Render `PicodashProvider` and `PicodashPanel`.

```tsx
import {
  PicodashPanel,
  PicodashPanelTrigger,
  PicodashProvider,
  PicodashSwitch,
} from '@picodash/panel'
import { settingsStore } from './settings-store'
import { usePicodashStoreSelector } from '@picodash/store/react'

export function SiteControls() {
  const exposure = usePicodashStoreSelector(settingsStore, (state) => {
    return typeof state.values.exposure === 'number' ? state.values.exposure : 1
  })

  return (
    <PicodashProvider theme="system" persistLayout storageKey="my-site:picodash-layout:v2">
      <main style={{ opacity: exposure }}>App content</main>
      <PicodashPanelTrigger store={settingsStore} variant="outline">
        Open settings panel
      </PicodashPanelTrigger>

      <PicodashPanel
        defaultVisible={false}
        store={settingsStore}
        title="Settings"
        defaultPlacement={{
          mode: 'floating',
          disposition: { kind: 'snapped', position: 'top-right' },
        }}
      >
        <PicodashSwitch field={settingsStore.fields.showGrid} label="Show grid" />
      </PicodashPanel>
    </PicodashProvider>
  )
}
```

## API Expectations

- Use `createPicodashStore` for application-owned state.
- Use `PicodashPanel` with `store` for app-owned modes.
- Use `@picodash/store` for typed store construction (`createPicodashStore`) to define application-owned
  validation and value contracts used with built-in and custom dashlets.
- Use `usePicodashPanel(panelId)` beneath `PicodashProvider` for reactive visibility and imperative
  `show`, `hide`, `toggle`, `setVisible`, show-and-raise `activate`, and `setPlacement` behavior.
  The controller's reactive `placement` reports stable floating, fixed, or hybrid mode plus its
  live free, snapped, or docked disposition.
- Use `PicodashPanelTrigger` or `PicodashPanelLauncher` for explicit user-facing launch points.
- Use `defaultVisible={false}` for an initially hidden but registered panel; visibility is not
  persisted with layout.
- Use `close` for a provider-managed hide button, or `close={{ behavior: 'deregister' }}` when the
  host will unmount after the provider removes the registration and portal. `onClose` is an
  optional observer and does not replace the default close behavior.
- The panel action menu is public and composable through `PicodashPanel`’s `actionMenu` prop.
  `undefined` gives the default menu, `false` hides it, and custom values may be:
  - an array of rows (`readonly ReactElement[]`) wrapped by the default root action submenu, or
  - a root `ActionSubmenu` element that replaces the default root trigger.
- Exported menu primitives include `ActionMenuItem`, `ActionSubmenu`, `ActionMenuSeparator`,
  `CopySubmenu`, `ExportSubmenu`, and the built-in row exports (`CopyJsonItem`, `CopyYamlItem`,
  `ExportJsonItem`, `ExportYamlItem`, `ExpandAllItem`, `CollapseAllItem`, `ImportItem`,
  `ResetItem`).
- Destructive rows use `destructive={[message, title?, buttonLabel?]}`.
  `title` defaults to the row label; `buttonLabel` defaults to `'Confirm'`.
- Use `setFieldValue` / `setFieldValues` for strict app writes.
- Use `setFieldInput` for interactive editors that should retain transient drafts.
- Use `PicodashItem`, `PicodashGroup`, and built-in items for custom compositions.
- Use `@picodash/panel/advanced` only when a task needs focused provider state through
  `usePicodashProviderSelector`, imperative provider access through `usePicodashProviderStoreApi`, or
  contextual panel access through `usePicodashPanelSelector` / `usePicodashPanelStoreApi`.
- Use `@picodash/panel/ui` for shared `aria-rhea` Button, Card, Tabs, overlay, and form primitives
  when composing bespoke dashlets. Import named `*Props` types from the same entrypoint, use
  component `variant`/`size` props instead of raw class helpers, and style custom surfaces with
  semantic `--picodash-*` tokens from the package stylesheet, including
  `--picodash-color-well`, `--picodash-color-data-1`, `--picodash-color-data-2`,
  `--picodash-color-data-3`, `--picodash-color-data-4`, and `--picodash-color-data-5` for
  visualization surfaces.
- Use the package's complete `dark` and `light` themes directly, or use `theme="system"` to follow
  `prefers-color-scheme` and its changes.
- Define custom themes by overriding semantic `--picodash-*` tokens under
  `data-picodash-theme`, and use `PicodashProvider<'brand' | 'contrast'>` when strict custom theme
  names are useful.
- Establish theme scope at `PicodashProvider` or override it at `PicodashPanel`. Dashlets and
  shared UI primitives inherit semantic tokens; only portaled overlay roots repeat the resolved
  theme outside that DOM ancestry.
- Do not use `usePicodashPanel(panelId)` to discover panel values. Panel data remains owned by the
  store passed to `PicodashPanel`.
- Use explicit placement objects. Floating supports free/all-edge snaps, Fixed supports
  corner/full/middle-side docks, and Hybrid supports free, top/bottom snaps, and corner/full-side
  docks.
- Keep Floating and Hybrid top/bottom snaps offset and floating-like. Hybrid side/corner drags keep
  the real panel natural-sized and use a proxy for the release target. Dock full sides flush at full
  height and corners flush at intrinsic height. Detach docked Hybrid panels after
  `snapProximity × detachThresholdMultiplier` without changing mode.
- Persist boundary-relative preferred coordinates. Derive constrained geometry at render time and
  keep peer alignment independent from container placement.
- Prefer `PicodashProvider panelBoundary={mainRef}` when all panels share an application surface.
  Use `PicodashPanel boundary={canvasRef}` only for a panel-specific surface, and
  `boundary={null}` to explicitly restore viewport bounds. Accept Elements and React refs, not CSS
  selector strings.
- Keep `portalContainer` and boundaries conceptually separate: the portal chooses render
  ownership, while the boundary constrains floating, snapping, fixed docking, and collapse-toggle
  geometry.
- Fixed `full-left` and `full-right` placements fill the effective boundary height. Start/end pinned lanes
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

## Migration Notes

This repository is on the promoted API. Only canonical Picodash persistence records hydrate;
invalid or obsolete records start from declared defaults.
Built-ins and compound dashlets use typed field handles from `@picodash/store`.

## Workspace App Surfaces

- `apps/web` (Next.js): production website, started with `bun run web`.
- `apps/lab` (Next.js): local-only debugging app, started with `bun run lab`.

`apps/web` route topology:

- `/` renders the home page.
- `/examples` is the curated example gallery.
- `/docs` is the docs umbrella route.
- Canonical docs routes:
  - `/docs/get-started/{manual,agent}`
  - `/docs/concepts/{state-ownership,panel-placement,dashlet-anatomy}`
  - `/docs/guides/{custom-dashlets,compound-dashlets,dashlet-themes,dashlet-accessibility}`
  - `/docs/reference/{store,panel,dashlet-components,dashlets,ui,diagnostics}`
- `/store`, `/usage`, `/themes`, `/more-examples` are compatibility routes.
- `/usage/components` redirects to `/docs/reference/dashlet-components`.
- not-found fallback for every other path.

`apps/lab` route topology:

- `/` and `/lab` both route to the local Contract Lab surface.

## Local Development

The deployment scripts require a globally installed Vercel CLI. Install it once with
`bun install --global vercel`.

- `bun install`
- `bun run lint`
- `bun run format`
- `bun run dev`
- `bun run web`
- `bun run lab`
- `bun run port:reserve`
- `bun run port:release`
- `bun run deploy`
- `bun run deploy:prod`
- `bun run --filter @picodash/lab lint`
- `bun run --filter @picodash/lab format`
- `bun run --filter @picodash/lab check`
- `bun run --filter @picodash/lab build`
- `bun run --filter @picodash/web lint`
- `bun run --filter @picodash/web format`
- `bun run --filter @picodash/panel lint`
- `bun run --filter @picodash/panel format`
- `bun run --filter @picodash/panel check`
- `bun run --filter @picodash/panel test`
- `bun run --filter @picodash/web check`
- `bun run test:e2e:web`
- `bun run test:e2e:lab`
- `bun audit --audit-level=high`
- `bun run --cwd packages/panel release:check`
- `bun run ready`

Focused validation:

- `vp run @picodash/panel#build` before workspace-wide checks or builds.
- `LAB_PORT=6032 WEBSITE_PORT=6033 bun run test:e2e:web`
- `LAB_PORT=6032 WEBSITE_PORT=6033 bun run test:e2e:lab`
- `apps/web/tests/routes.spec.ts` verifies the production route boundary and local lab
  `data-product-route` markers.

If an allocated port is occupied while an agent needs to briefly run a server, find a free port in
`6034-6039` and pass it through the relevant environment variable.

For new worktrees, use `bun run port:reserve` to claim the lowest available port in `6034-6039`.
It writes the allocation as `<PORT>:<DATETIME>:<WORKTREE_DIR>` to
`/Volumes/Jove/Developer/Projects/picodash/.worktree-ports` and sets both `WEBSITE_PORT` and
`LAB_PORT` in the worktree's `.env.local`. Use `bun run port:release` after the PR is merged.

GitHub CI runs parallel quality and E2E jobs for pull requests and pushes to `main`.
