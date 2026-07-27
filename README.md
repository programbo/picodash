# Picodash

Monorepo for the promoted [Picodash] package, its production website, and local debugging labs.

> **Public preview:** Picodash is currently available for reading, evaluation, and issue feedback.
> Pull requests are temporarily disabled while the API and maintenance workflow settle.

## Active product topology

- `packages/panel`: published package API for application-owned inspector panels.
- `apps/web`: production Next.js App Router website and public product experience.
- `apps/lab`: local-only Next.js debugging app. It is exercised by E2E tests but is not a
  production website or deployment target.

### `apps/web` route topology

- `/` renders the home root.
- `/store`, `/usage`, `/themes`, `/more-examples` render public detail routes.
- unknown paths render the app's 404 page.

### `apps/lab` route topology

- `/` and `/lab` redirect to `/lab/state`.
- `/lab/state/{provider,scene,built-in-items,custom-items}` expose the state fixtures.
- `/lab/panel-geometry`, `/lab/panel-interaction`, and `/lab/dashlets` expose focused debugging
  fixtures.

The lab runs locally with `bun run lab`. `/demo` and the former debugging routes hosted by
`apps/web` are not active production routes.

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
    <PicodashProvider persistLayout storageKey="my-app:picodash-layout:v2" theme="system">
      <main style={{ filter: `blur(${exposure * 0.2}px)` }}>Scene preview</main>

      <PicodashPanel
        store={sceneStore}
        title="Scene"
        collapsible
        defaultPlacement={{
          mode: 'floating',
          disposition: { kind: 'snapped', position: 'top-right' },
        }}
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

### Themes

`@picodash/panel/style.css` ships complete `dark` and `light` Picodash themes. Use
`theme="system"` to follow the operating system's `prefers-color-scheme` setting; the provider
updates its resolved theme when that setting changes.

Consumer themes are CSS-only and use the emitted `data-picodash-theme` attribute:

```css
:where([data-picodash-theme='brand']) {
  --picodash-color-surface: #172033;
  --picodash-color-text: #f4f7ff;
  --picodash-color-accent: #8ab4ff;
}
```

Theme names can be made strict and autocomplete-friendly with the provider generic:

```tsx
type AppTheme = 'brand' | 'contrast'

function App() {
  return <PicodashProvider<AppTheme> theme="brand">...</PicodashProvider>
}
```

The generic extends the built-in `dark`, `light`, and `system` options. The gallery's `ocean`,
`plum`, `tron`, and `contrast` recipes are demo-only examples, not package-provided themes.

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

### Panel action menu (public API)

`PicodashPanel` supports a composable `actionMenu` prop:

```tsx
import {
  ActionMenuItem,
  ActionSubmenu,
  ActionMenuSeparator,
  CopySubmenu,
  ExportSubmenu,
  PicodashPanel,
  PicodashPanelActionMenu,
} from '@picodash/panel'
```

- `actionMenu: undefined` uses the default menu.
- `actionMenu: false` hides the header menu.
- `actionMenu: readonly ReactElement[]` renders those items in a root `ActionSubmenu`.
- `actionMenu` as a single `ActionSubmenu` replaces the root trigger.

Default menu (undefined) includes the same internal rows as built-ins:

- `Expand all`
- `Collapse all`
- `Copy JSON`
- `Copy YAML`
- `Export JSON`
- `Export YAML`
- `Import…`
- `Reset…`

`CopySubmenu` and `ExportSubmenu` are provided and can be reused to match default nesting.

Icons are React component constructors typed as `LucideIcon` so icon imports stay tree-shakeable:

- `ActionMenuItemProps.icon?: LucideIcon`
- `ActionSubmenuProps.icon?: LucideIcon`

`destructive` is a 3-tuple for confirmation:

```ts
type ActionMenuConfirmation = readonly [message: string, title?: string, buttonLabel?: string]
```

Defaults:

- `title` defaults to the row `label`.
- `buttonLabel` defaults to `'Confirm'`.

### Placement and panel boundaries

Panel placement separates a stable `mode` (`floating`, `fixed`, or `hybrid`) from its live
`disposition` (`free`, `snapped`, or `docked`):

```tsx
<PicodashPanel
  store={sceneStore}
  collapsible
  defaultPlacement={{
    mode: 'hybrid',
    disposition: { kind: 'docked', position: 'full-right' },
  }}
  placementOptions={{
    snapOffset: 8,
    snapProximity: 16,
    detachThresholdMultiplier: 2.5,
  }}
/>
```

Floating panels may be free or snapped to any edge or corner. Snaps retain the panel's preferred
coordinate on the unsnapped axis and use `snapOffset`. Fixed panels dock flush at a corner,
`full-left`, `full-right`, `middle-left`, or `middle-right`; full sides fill the boundary height,
while corners and middle sides keep their intrinsic height.

Hybrid panels remain Hybrid while moving between dispositions. Free and top/bottom-snapped Hybrid
panels behave like Floating panels. Side and corner candidates show an animated proxy and dock only
on release; corners retain intrinsic height and full sides fill the boundary. A docked Hybrid panel
resists detachment for `snapProximity × detachThresholdMultiplier`, then immediately becomes free
without changing mode. Reduced-motion preferences disable proxy springs.

`collapsible/defaultCollapsed` is one capability and state. Free or snapped panels collapse their
body into the header; docked panels retract beyond their boundary and expose Reveal. The collapsed
state survives disposition changes. Fixed panels are not draggable by default; `drag={false}` can
disable dragging in the other modes.

In docked panels, start- and end-pinned lanes remain visible while the auto lane scrolls. Every
panel scrollport includes the bundled `scroll-fade` utility through
`@picodash/panel/style.css`.

The viewport is the default geometry boundary. Set `panelBoundary` on `PicodashProvider` to
constrain every panel to an `Element` or React ref, then use a panel's `boundary` prop for an
override. `boundary={null}` explicitly restores the viewport. Boundaries do not change portal
ownership or resize application content; fixed panels overlay their boundary.

`usePicodashPanel(panelId)` also exposes reactive `placement` and `setPlacement()`. Runtime
placement and boundary-relative preferred coordinates persist when `persistLayout` is enabled.
Only canonical Picodash placement records hydrate; invalid or obsolete records start from declared
defaults. Selectors are not accepted as boundary inputs; resolve one to an `Element` or use a ref.

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

- `6030`: web development server via `WEBSITE_PORT`.
- `6031`: web production preview (`start`) server via `WEBSITE_PORT`.
- `6032`: local lab development server via `LAB_PORT`.
- `6033`: web E2E server via `WEBSITE_PORT`.

Ports `6034-6039` can be temporarily allocated to worktrees so development and E2E servers can
run without conflicting with the shared project servers. If an agent needs to briefly run a server
and its allocated port is occupied, it should find a free port in `6034-6039` and pass that port
through the relevant environment variable.

Assign new local services only from the available slots in `6034-6039`, and document it
if the service becomes a part of the project.

For this worktree:

```bash
LAB_PORT=6034 WEBSITE_PORT=6035 bun run --filter @picodash/web test:e2e
```

## Current commands

The deployment scripts intentionally use a global Vercel CLI. Install it once before running
either deployment command:

```bash
bun install --global vercel
```

```bash
bun install
bun run lint
bun run format
bun run dev
bun run web
bun run lab
bun run deploy
bun run deploy:prod
bun run --filter @picodash/lab lint
bun run --filter @picodash/lab format
bun run --filter @picodash/lab check
bun run --filter @picodash/lab build
bun run --filter @picodash/web lint
bun run --filter @picodash/web format
bun run --filter @picodash/panel lint
bun run --filter @picodash/panel format
bun run --filter @picodash/panel check
bun run --filter @picodash/panel test
bun run --filter @picodash/panel build
bun run --filter @picodash/web check
bun run --filter @picodash/web test:e2e
vp run @picodash/panel#build && bun run --filter @picodash/web build
bun audit --audit-level=high
bun run --cwd packages/panel release:check
bun run ready
```

Focused checks:

```bash
LAB_PORT=6034 WEBSITE_PORT=6035 bun run --filter @picodash/web test:e2e
```

`bun run ready` remains the full verification gate:

```bash
vp run @picodash/panel#build && vp check && vp run -r test && vp run -r build && bun run --filter @picodash/web test:e2e
```

GitHub CI runs parallel quality and E2E jobs for pull requests and pushes to `main`. The quality job
runs the audit, workspace checks, and unit tests; the E2E job builds the workspace and runs the
Playwright end-to-end suite against both apps. The Playwright runner and specs remain under
`apps/web/tests`; `routes.spec.ts` asserts the production route boundary and local lab route
markers. Publishing the package also runs its check, test, and build commands.
