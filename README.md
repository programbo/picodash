# Picodash

Monorepo for the promoted [Picodash] package and its web showcase apps (`apps/web`, `apps/website`).

> **Public preview:** Picodash is currently available for reading, evaluation, and issue feedback.
> Pull requests are temporarily disabled while the API and maintenance workflow settle.

## Active product topology

- `packages/panel`: published package API for application-owned inspector panels.
- `apps/web`: canonical Next.js app-router showcase for the same interactive product experiences.
- `apps/website`: legacy Vite showcase with the same route shape and feature examples.

### `apps/web` route topology

- `/` and `/gallery` render the gallery root (with `/gallery` redirecting to `/`).
- `/store`, `/usage`, `/more-examples` render gallery detail routes.
- `/state-lab/provider`, `/state-lab/scene`, `/state-lab/built-in-items`, `/state-lab/custom-items` render State Lab tabs.
- `/panel-geometry-lab` renders geometry fixture route.
- unknown paths render the app's 404 page.

Relationship: `apps/web` is the Next.js source app for route-based demos, while `apps/website` remains the existing Vite-based source with the same public route behavior.

- Legacy `/demo` integration and old schema-driven API are not part of this workspace and should not be documented as active APIs.

## Breaking migration notes

- Legacy panel imports and specs now map to `@picodash/panel` imports. The prior schema-driven registration API and its persistence contracts are retired and are not migrated.
- If your app imported `panel` in this workspace, map it directly to `@picodash/panel` specifiers (`@picodash/panel`, `@picodash/panel/advanced`, `@picodash/panel/ui`, `@picodash/panel/style.css`).
- External consumer `Gearmo` is a known breaking downstream that requires its own migration planning and coordination.

## Install and style import

```bash
bun add @picodash/panel
```

```tsx
import '@picodash/panel/style.css'
```

## Quick start

```tsx
import {
  createPicodashPanelStore,
  PicodashPanel,
  PicodashProvider,
  PicodashSlider,
  PicodashSwitch,
  PicodashText,
  usePicodashPanelStoreSelector,
} from '@picodash/panel'
import '@picodash/panel/style.css'

const sceneStore = createPicodashPanelStore({
  panelId: 'scene-controls',
  initialValues: { bloom: true, exposure: 1.2, quality: 'balanced' },
})

export function App() {
  const exposure = usePicodashPanelStoreSelector(sceneStore, (state) => {
    return typeof state.values.exposure === 'number' ? state.values.exposure : 1
  })

  return (
    <PicodashProvider persistLayout storageKey="my-app:tweaker-layout:v1" theme="system">
      <main style={{ filter: `blur(${exposure * 0.2}px)` }}>Scene preview</main>

      <PicodashPanel
        store={sceneStore}
        title="Scene"
        collapsible
        defaultPlacement="top-right"
        width={360}
      >
        <PicodashSwitch field="bloom" label="Bloom" defaultValue={true} />
        <PicodashSlider
          field="exposure"
          label="Exposure"
          defaultValue={1.2}
          min={0.2}
          max={2.5}
          step={0.05}
        />
        <PicodashText
          field="quality"
          label="Quality"
          defaultValue="balanced"
          // keep value domain tight and JSON-compatible
          parse={(input) => {
            return input === 'draft' || input === 'balanced' || input === 'final'
              ? { success: true, output: { value: input } }
              : { success: false, errors: ['quality must be draft, balanced, or final'] }
          }}
        />
      </PicodashPanel>

      <p>Current exposure: {exposure}</p>
    </PicodashProvider>
  )
}
```

## Promoted API surface

All package usage should be built on `PicodashProvider` + panel stores.

- Store ownership and strict writes: `createPicodashPanelStore`, `setFieldValue`, `setFieldValues`.
- UI controls and panels: `PicodashPanel`, `PicodashItem`, and built-in inputs/visualization components.
- State selectors and panel UI control: `usePicodashPanelStoreSelector`, `usePicodashPanel`.
- Validation contracts: synchronous `parse`/`validate` per field and optional Standard Schema validators.
- Advanced tools: `@picodash/panel/advanced` for focused provider/panel selectors, imperative store access,
  helpers, ordering and persistence wiring.
- Shared UI primitives: `@picodash/panel/ui` for the package-owned shadcn `aria-rhea` components used by
  Picodash and workspace consumers. Their interaction props follow React Aria conventions.
- Styling import: `import '@picodash/panel/style.css'`.
- No separate dist stylesheet import should be documented (the package export maps that path).

### Panel visibility and activation

Use `usePicodashPanel(panelId)` beneath `PicodashProvider` to control a registered panel. The hook
returns `null` until registration and otherwise exposes reactive `visible` state plus `show`,
`hide`, `toggle`, `setVisible`, and show-and-raise `activate` methods. Set
`defaultVisible={false}` when a panel should register without initially appearing. Visibility is
transient; persisted provider layout still contains position and docking only.

Set `close` to add a header close button immediately after the action menu. `close` and
`close={{ behavior: 'hide' }}` hide through the provider; `close={{ behavior: 'deregister' }}`
removes the registration and portal so an optional `onClose({ panelId, behavior })` observer can
unmount the host component. The callback observes the built-in behavior rather than replacing it.

### Placement and panel boundaries

Panels support floating, magnetic, and fixed placement. Existing corner strings remain valid for
`defaultPlacement`; use the object form for magnetic snapping and fixed sidebars:

```tsx
<PicodashPanel
  store={sceneStore}
  collapsible
  defaultPlacement={{ mode: 'fixed', position: 'right' }}
/>
```

Magnetic positions use `PicodashPanelSnapPosition`; fixed positions use
`PicodashPanelFixedPosition`.

Fixed positions are `top-left`, `bottom-left`, `top-right`, `bottom-right`, `left`, and `right`.
The full-edge `left` and `right` positions fill the boundary height. In fixed panels, start- and
end-pinned lanes remain visible while the auto lane scrolls. Every panel scrollport includes the
bundled `scroll-fade` utility through `@picodash/panel/style.css`.

The viewport is the default geometry boundary. Set `panelBoundary` on `PicodashProvider` to
constrain every panel to an `Element` or React ref, then use a panel's `boundary` prop for an
override. `boundary={null}` explicitly restores the viewport. Boundaries do not change portal
ownership or resize application content; fixed panels overlay their boundary.

`usePicodashPanel(panelId)` also exposes reactive `placement` and `setPlacement()`. Runtime placement
changes join coordinates and magnetic/fixed edge state in provider layout persistence when
`persistLayout` is enabled. Selectors are not accepted as boundary inputs; resolve one to an
`Element` or use a ref.

### Advanced hook boundary

The main entrypoint keeps application ownership explicit: use
`usePicodashPanelStoreSelector(store, selector)` for panel values and `usePicodashPanel(panelId)` only
for provider-managed visibility and activation. `@picodash/panel/advanced` exposes
`usePicodashProviderSelector`, `usePicodashProviderStoreApi`, `usePicodashPanelSelector`, and
`usePicodashPanelStoreApi` for low-level integrations. The contextual panel hooks must run beneath
the rendered `PicodashPanel`; they do not look up application state by panel ID.

### JSON-compatibility rule

Panel values, storage payloads, imports/exports, and custom metadata must remain JSON-compatible.
File metadata must be plain objects, and derived/high-frequency renderers should remain non-authoritative to the panel store.

### Import and export

Panel copy/export utilities are table-driven from panel registration.
Display-only fields are included in copies/exports.
Repairs from imports and constraint propagation are reviewable through the built-in repair workflow and are committed only after acceptance.

### Validation and reactive behavior

- Synchronous `parse` and `validate` are enforced before any mutation.
- Custom parser and validator callbacks should be hoisted or stabilized with `useCallback` so
  their contracts are not re-registered on every render.
- Promise-based parsers and validators are not supported.
- Field metadata changes (for example `min`, `max`, `options`, `readOnly`, `hidden`, labels/help/status) can be passed from state and re-registered; values are normalized to the active contract.

### Built-ins (high-level)

- Text/number/select/switch controls and grouped compositions.
- Visual components: `PicodashSparkline`, `PicodashChart`, `PicodashGradient`, `PicodashMediaPreview`, `PicodashDropzone`.
- Spatial and matrix controls, range/vector controls, and display/readout rows.
- Charts are typed through discriminated variants (`type: 'line' | 'bar' | 'area' | 'pie' | 'radar' | 'radial'`).

## Documentation targets to keep aligned

- `README.md`: workspace setup, installation, runbook, topology.
- `packages/panel/README.md`: API, usage patterns, and feature behavior.
- `CONTRIBUTING.md`: current public-preview contribution policy.
- `RELEASING.md`: package versioning and release checklist.
- `SKILL.md`: agent workflow guidance.
- `AGENTS.md`: verification and port conventions.
- `llms.txt`: short topology and migration summary.

## Ports

`ports` allocation owns `6030-6039`.

- `6030`: `apps/website` dev and Playwright web server.
- `6031`: `apps/website` preview.
- `6035`: this worktree override via `WEBSITE_PORT`.
- `6032-6034` and `6036-6039`: available.

Use the next available port in this range for new local services and document it.

For this worktree:

```bash
WEBSITE_PORT=6035 bun run website
WEBSITE_PORT=6035 bun run --filter website test:e2e
```

## Current commands

```bash
bun install
bun run dev
bun run website
bun run web
bun run --filter @picodash/panel check
bun run --filter @picodash/panel test
bun run --filter @picodash/panel build
bun run --filter website test:e2e
bun run --filter @picodash/web check
bun run --filter @picodash/web test:e2e
vp run @picodash/panel#build && bun run --filter @picodash/web build
bun audit --audit-level=high
bun run --cwd packages/panel release:check
bun run ready
```

Focused checks:

```bash
WEBSITE_PORT=6035 bun run web
WEBSITE_PORT=6035 bun run --filter @picodash/web test:e2e
WEBSITE_PORT=6035 bun run website
WEBSITE_PORT=6035 bun run --filter website test:e2e
```

`bun run ready` remains the full verification gate:

```bash
vp run @picodash/panel#build && vp check && vp run -r test && vp run -r build && bun run --filter website test:e2e
```

GitHub CI runs parallel quality and E2E jobs for pull requests and pushes to `main`. The quality job
runs the audit, workspace checks, and unit tests; the E2E job builds the workspace and runs the
Playwright end-to-end suite. Publishing the package also runs its check, test, and build commands.
