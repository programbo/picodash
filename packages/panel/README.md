# Picodash

A composable React inspector-panel package with application-owned state, synchronous validation contracts, and built-in controls/visualizations.

> **Public preview:** The package API is still evolving. See the repository's
> [release policy](https://github.com/programbo/picodash/blob/main/RELEASING.md) before depending on a versioned release.

The workspace has separate production and local debugging Next.js App Router apps:

- `apps/web`: production website for public docs and product pages.
- `apps/lab`: local-only debugging app; it is exercised by E2E tests but is not a production
  deployment target.

`apps/web` route topology:

- `/` renders the home root.
- `/store`, `/usage`, `/usage/components`, `/themes`, `/more-examples` render public routes.
- missing paths render the 404 page.

The local app redirects `/` and `/lab` to `/lab/state`, then serves state fixtures at
`/lab/state/{provider,scene,built-in-items,custom-items}` and
focused fixtures at `/lab/panel-geometry`, `/lab/panel-interaction`, and `/lab/dashlets`.
`/demo` and the former debugging routes hosted by `apps/web` are not active production routes.

## Migration boundary

- This package is the promoted API. Old schema-driven specifiers and behavior (schema-driven registration and the old persistence shape) are retired.
- Legacy `panel` imports map to `@picodash/panel` imports in this repository context.
- There is no compatibility package facade and no npm deprecation migration helper here.

## Imports and styles

Next.js App Router modules that render Picodash components must be client components. Add
`'use client'` to the consuming module; the package does not force that boundary on every import.

```tsx
import {
  createPicodashPanelStore,
  PicodashPanel,
  PicodashProvider,
  PicodashGroup,
  usePicodashPanelStoreSelector,
} from '@picodash/panel'
import '@picodash/panel/style.css'
```

Reusable shadcn components are centralized in the package and exported from `@picodash/panel/ui`:

```tsx
import { Button, Card, Tabs, TabsContent, TabsList, TabsTrigger } from '@picodash/panel/ui'
```

These components use the `aria-rhea` React Aria contracts, including `id`, `selectedKey`,
`onSelectionChange`, `isDisabled`, `onAction`, and `data-selected`. Add or update shared shadcn
components from `packages/panel`; consuming workspaces should not install duplicate copies.

### Third-party dashlet UI toolkit

Use `@picodash/panel/ui` to compose bespoke dashlets from the same first-party, theme-aware
elements used by Picodash's built-ins:

```tsx
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@picodash/panel/ui'
import type { ButtonProps, CardProps, SelectProps } from '@picodash/panel/ui'
```

Every exported primitive has a named `*Props` type, and interaction props follow React Aria
(`isDisabled`, `selectedKey`, `onSelectionChange`, `onAction`, and related `data-*` state
attributes). Prefer component `variant` and `size` props over importing implementation-level
class helpers. Import `@picodash/panel/style.css` once at the application root; its semantic
`--picodash-*` tokens provide the light, dark, system, and consumer-defined theme contract for
custom markup and visualizations. Use `ItemSurface`, `ItemCaption`, `ItemLegend`,
`ItemLegendItem`, and `ItemEmptyState` for common visualization and empty-state compositions. For
visualization surfaces, use the public
`--picodash-color-well` token and the `--picodash-color-data-1`, `--picodash-color-data-2`,
`--picodash-color-data-3`, `--picodash-color-data-4`, and `--picodash-color-data-5` palette. Root
overlays retain the provider portal/theme contract, while nested menus stay in their parent
overlay.

## Quick start

```tsx
import {
  createPicodashPanelStore,
  PicodashGroup,
  PicodashNumber,
  PicodashPanel,
  PicodashProvider,
  PicodashSelect,
  PicodashSlider,
  PicodashSwitch,
  usePicodashPanelStoreSelector,
} from '@picodash/panel'
import '@picodash/panel/style.css'

const sceneStore = createPicodashPanelStore({
  panelId: 'scene',
  initialValues: {
    bloom: true,
    quality: 'balanced',
    exposure: 1.2,
    opacity: 0.72,
  },
})

function ScenePanel() {
  const exposure = usePicodashPanelStoreSelector(sceneStore, (state) => {
    return typeof state.values.exposure === 'number' ? state.values.exposure : 1
  })

  return (
    <PicodashProvider theme="system" persistLayout storageKey="my-app:picodash-layout:v2">
      <PicodashPanel
        store={sceneStore}
        title="Scene"
        defaultPlacement={{
          mode: 'floating',
          disposition: { kind: 'snapped', position: 'top-right' },
        }}
        width={360}
      >
        <PicodashGroup id="render" label="Render">
          <PicodashSwitch field="bloom" label="Bloom" defaultValue={true} />
          <PicodashSlider
            field="exposure"
            label="Exposure"
            defaultValue={1.2}
            min={0.2}
            max={3}
            step={0.05}
            formatOptions={{ style: 'decimal', maximumFractionDigits: 2 }}
          />
          <PicodashSelect
            field="quality"
            label="Quality"
            defaultValue="balanced"
            options={[
              { label: 'Draft', value: 'draft' },
              { label: 'Balanced', value: 'balanced' },
              { label: 'Final', value: 'final' },
            ]}
          />
          <PicodashNumber
            field="opacity"
            label="Opacity"
            defaultValue={0.72}
            min={0}
            max={1}
            step={0.01}
          />
        </PicodashGroup>
      </PicodashPanel>

      <span>Exposure: {exposure}</span>
    </PicodashProvider>
  )
}
```

## Panel store model

- `createPicodashPanelStore({ panelId, initialValues, initialMeta })` creates application-owned store state.
- `PicodashPanel` may render that store via `store` prop.
- `usePicodashPanelStoreSelector` reads store slices without recreating local mirrors.
- `usePicodashPanel(panelId)` returns a registered panel controller with reactive `visible` state
  and `placement` plus `show`, `hide`, `toggle`, `setVisible`, show-and-raise `activate`, and
  `setPlacement` methods.
- Panel values remain application-owned and are never discovered globally through a panel ID.
- `defaultVisible={false}` registers a panel in a hidden state; visibility is transient and is not
  stored with persisted layout.
- `close` adds a header close button that hides by default. Use
  `close={{ behavior: 'deregister' }}` to remove the provider registration and rendered portal;
  optional `onClose` observes the completed default behavior and can unmount the host component.
- Internal-store panels are supported with `PicodashPanel id + initialValues/initialMeta`; this mode is UI-local unless app state is injected.
- `setFieldValue` and `setFieldValues` are strict and atomic.
- `setFieldInput` is the interactive path that may keep non-persisted drafts with validation feedback while preserving canonical values.

## Placement and boundaries

`defaultPlacement` uses an explicit mode and disposition:

```ts
type PicodashPanelPlacement =
  | {
      mode: 'floating'
      disposition: { kind: 'free' } | { kind: 'snapped'; position: PicodashPanelSnappedPosition }
    }
  | {
      mode: 'fixed'
      disposition: { kind: 'docked'; position: PicodashPanelDockedPosition }
    }
  | {
      mode: 'hybrid'
      disposition:
        | { kind: 'free' }
        | { kind: 'snapped'; position: 'top' | 'bottom' }
        | { kind: 'docked'; position: PicodashPanelHybridDockPosition }
    }

type PicodashPanelBoundary = Element | React.RefObject<Element | null>
```

`PicodashPanelSnappedPosition` covers all four edges and corners.
`PicodashPanelDockedPosition` covers corners, `full-left`, `full-right`, `middle-left`, and
`middle-right`. Hybrid docking is restricted to corners and full sides.

Use a provider boundary when panels should share the same working area, and a panel override only
when one panel belongs to a different surface:

```tsx
const canvasStore = createPicodashPanelStore({ panelId: 'canvas-tools' })
const mainRef = useRef<HTMLElement>(null)
const canvasRef = useRef<HTMLDivElement>(null)

<PicodashProvider panelBoundary={mainRef} persistLayout>
  <main ref={mainRef}>
    <div ref={canvasRef} />
  </main>

  <PicodashPanel
    store={sceneStore}
    collapsible
    defaultPlacement={{
      mode: 'fixed',
      disposition: { kind: 'docked', position: 'full-left' },
    }}
  />

  <PicodashPanel
    store={canvasStore}
    boundary={canvasRef}
    defaultPlacement={{
      mode: 'fixed',
      disposition: { kind: 'docked', position: 'bottom-right' },
    }}
  />
</PicodashProvider>
```

- The viewport is the default boundary. `boundary={null}` explicitly opts a panel out of an
  inherited provider boundary.
- Boundary inputs are direct `Element` values or React refs. CSS selectors are not resolved by the
  package.
- Boundaries control geometry only. `portalContainer` independently controls where panel portals
  render, and fixed panels overlay rather than inset application content.
- Floating panels remain constrained to the effective boundary. Only panels with the same resolved
  boundary participate in peer snapping, and peer alignment never creates a container placement.
- Floating snaps use `placementOptions.snapOffset` (default `8`) and become active within
  `snapProximity` (default `16`). Preferred boundary-relative coordinates retain the unsnapped axis.
- Hybrid top/bottom snaps are offset and floating-like. Side/corner targets show a proxy, then dock
  flush on release. Full sides fill the boundary; corners retain intrinsic height. Docked Hybrid
  panels detach after `snapProximity × detachThresholdMultiplier` (default `2.5`) and remain Hybrid.
- Fixed full sides fill the effective boundary height. Fixed corners and middle sides retain
  intrinsic height, with middle sides centered vertically.
- `collapsible/defaultCollapsed` collapses free/snapped bodies and retracts docked panels. The same
  collapsed state survives disposition changes.
- `usePicodashPanel(panelId).setPlacement(...)` changes placement at runtime. Returning to floating
  restores preferred coordinates subject to boundary containment.
- Placement persists with provider layout only when `persistLayout` is enabled. Only canonical
  Picodash placement records hydrate; invalid or obsolete records start from declared defaults.

## Validation and value contracts

- Field-backed items accept synchronous `parse` and `validate`.
- Hoist custom `parse` and `validate` functions or stabilize them with `useCallback`; changing
  callback identities re-registers the field contract.
- Standard Schema validators (for example Zod) are supported.
- Promise-valued contracts are rejected.
- Shared fields must pass a common contract chain; all validators are combined.

## JSON-compatible state

All values that cross store boundaries should be JSON-compatible.
Composite objects are allowed only when serializable.
Dropzone media values are metadata records and safe image URLs rather than raw objects.

## Built-ins

- Inputs: `PicodashText`, `PicodashNumber`, `PicodashSlider`, `PicodashSwitch`, `PicodashSelect`, `PicodashSegmented`, `PicodashVector3`, `PicodashRange`, `PicodashXYPad`, `PicodashAlignment`, `PicodashMatrix2D`.
- Media and files: `PicodashDropzone`, `PicodashMediaPreview`.
- Display/derived: `PicodashDisplay`.
- Live visuals: `PicodashSparkline`, `PicodashChart` (typed variants).
- Gradient utility: `PicodashGradient` and rotation-field pairing.

### Sparklines

`data` accepts finite arrays, restartable async iterable factories, or subscription sources.
Use `autoscale` for symmetric shared ranges and `continuous` for sustained streaming while visible.
`maxPoints` controls history retention. Use `onSourceError` to observe an async source that stops
with an error.

### Charts

`PicodashChart` is a typed discriminated union on `type` and supports only compatible props per variant (`area`, `bar`, `line`, `pie`, `radar`, `radial`).
Recharts is loaded lazily when a chart is rendered. The Dropzone implementation similarly loads
`react-dropzone` only when that control is rendered; both public components and their types remain
available from the main entrypoint.

### Action menu

`PicodashPanel` exposes `actionMenu` as a composable contract and exports the menu primitives:

- `ActionMenuItem`
- `ActionMenuSeparator`
- `ActionSubmenu`
- `CopySubmenu`
- `ExportSubmenu`
- `ExpandAllItem`, `CollapseAllItem`, `CopyJsonItem`, `CopyYamlItem`,
  `ExportJsonItem`, `ExportYamlItem`, `ImportItem`, `ResetItem`

`actionMenu` behavior:

- `undefined` (default): built-in menu with up to eight rows (conditionally showing `Expand all` /
  `Collapse all`, then `Copy JSON`, `Copy YAML`, `Export JSON`, `Export YAML`, `Import…`, `Reset…`).
- `false`: hide the menu.
- `readonly ReactElement[]`: create a root menu populated by your array.
- single `ActionSubmenu` root: replace the default trigger and root label/action.

Built-ins:

- `CopySubmenu` (`Clipboard`) and `ExportSubmenu` (`Download`) are available for composition.
- `Import…` and `Reset…` are row items; `Reset…` is destructive.
- `Expand all` / `Collapse all` appear when collapsible group state exists and may be hidden otherwise.

`ActionMenuItemProps` and `ActionSubmenuProps` use `LucideIcon` for icon props:

```ts
type ActionMenuItemProps = { icon?: LucideIcon; ... }
type ActionSubmenuProps = { icon?: LucideIcon; ... }
```

`destructive` uses a tuple and defaults row confirm strings:

```ts
type ActionMenuConfirmation = readonly [message: string, title?: string, buttonLabel?: string]
```

- `title` defaults to the row label.
- `buttonLabel` defaults to `'Confirm'`.

## Items and layout

`PicodashItem` is the shared row shell for built-in and custom controls.

- `field` binds to store value.
- `id` is required for non-field display rows.
- `contentLayout` is `inline`, `block`, or `full`.
- `PicodashGroup` supports `pin="start"` and `pin="end"` placement bands.
- Fixed and docked Hybrid panels keep the start and end bands visible while only the auto band
  scrolls. Floating panels keep their single body scrollport.
- Each panel scrollport includes `scroll-fade` through `@picodash/panel/style.css`; consumers do not need a
  separate shadcn stylesheet import.
- Reorder handles support pointer dragging and keyboard pick-up with Space/Enter, movement with
  Arrow Up/Down, dropping with Space/Enter, and cancellation with Escape.

## Local verification

From the workspace root:

```bash
bun run --filter @picodash/panel lint
bun run --filter @picodash/panel format
```

Workspace preview and production deployments use the root scripts and require a globally installed
Vercel CLI:

```bash
bun install --global vercel
bun run deploy
bun run deploy:prod
```

## Release verification

Pull requests and pushes to `main` run parallel quality and E2E jobs. The quality job runs
`bun audit --audit-level=high`, the panel package build, workspace checks, and unit tests; the E2E job builds the workspace
and runs the Playwright end-to-end suite against both apps, including
`apps/web/tests/routes.spec.ts` production-boundary and local-lab route checks.
Package publication independently runs package checks,
tests, and the build, which includes source maps.

## Themability

- Themes resolve as panel override, provider theme, then `"dark"` fallback.
- The package stylesheet ships complete `"dark"` and `"light"` themes.
- `"system"` follows `prefers-color-scheme` and updates when the system preference changes.
- Supported provider themes are `"dark"`, `"light"`, `"system"`, plus names supplied through the
  provider generic.
- Theme names are emitted through `data-picodash-theme` on provider and portal surfaces.
- `usePicodashTheme()` returns the resolved name for custom controls.

Define custom themes in consumer CSS by overriding the semantic token roles:

```css
:where([data-picodash-theme='brand']) {
  --picodash-color-surface: #172033;
  --picodash-color-text: #f4f7ff;
  --picodash-color-accent: #8ab4ff;
}
```

Use a provider generic to make the custom names part of the strict `theme` prop type:

```tsx
type AppTheme = 'brand' | 'contrast'

function App() {
  return <PicodashProvider<AppTheme> theme="brand">...</PicodashProvider>
}
```

The `ocean`, `plum`, `tron`, and `contrast` recipes used by the interactive gallery remain demo-only examples.

## Theme token contract

- Spacing and geometry: `--picodash-space-0-5`, `--picodash-space-1`, `--picodash-space-1-5`, `--picodash-space-2`, `--picodash-space-2-5`, `--picodash-space-3`, `--picodash-space-4`, `--picodash-space-5`, `--picodash-radius-surface`, `--picodash-radius-control`, `--picodash-control-height-xs`, `--picodash-control-height-sm`, `--picodash-control-height-md`, `--picodash-control-height-lg`, `--picodash-field-surface-min-height`, `--picodash-icon-xs`, `--picodash-icon-sm`, `--picodash-icon-md`, `--picodash-icon-lg`, `--picodash-panel-width`
- Typography primitives: `--picodash-font-family`, `--picodash-font-size-xs`, `--picodash-font-size-sm`, `--picodash-font-size-md`, `--picodash-font-size-lg`, `--picodash-font-size-xl`, `--picodash-font-size-2xl`, `--picodash-font-size-3xl`, `--picodash-line-none`, `--picodash-line-tight`, `--picodash-line-normal`, `--picodash-line-relaxed`, `--picodash-font-light`, `--picodash-font-normal`, `--picodash-font-medium`, `--picodash-font-semibold`, `--picodash-tracking-normal`, `--picodash-tracking-wide`
- Interaction surface tuning: `--picodash-opacity-disabled`, `--picodash-opacity-disabled-soft`, `--picodash-opacity-muted`, `--picodash-opacity-subtle`, `--picodash-border-thin`, `--picodash-shadow-sm`, `--picodash-shadow-md`, `--picodash-shadow-panel`, `--picodash-shadow-viewer`, `--picodash-shadow-inner`, `--picodash-duration-fast`, `--picodash-ease-out`, `--picodash-blur-surface`, `--picodash-blur-overlay`
- Layer elevations and z-order: `--picodash-layer-raised`, `--picodash-layer-drag`, `--picodash-layer-tooltip`, `--picodash-layer-select`, `--picodash-layer-menu`, `--picodash-layer-dialog`, `--picodash-layer-viewer`
- Palette: `--picodash-color-canvas`, `--picodash-color-surface`, `--picodash-color-surface-raised`, `--picodash-color-surface-muted`, `--picodash-color-text`, `--picodash-color-text-strong`, `--picodash-color-text-muted`, `--picodash-color-border`, `--picodash-color-control`, `--picodash-color-focus`, `--picodash-color-accent`, `--picodash-color-accent-text`, `--picodash-color-success`, `--picodash-color-info`, `--picodash-color-warning`, `--picodash-color-alert`, `--picodash-color-danger`, `--picodash-color-overlay`

## Advanced exports

Use `@picodash/panel/advanced` for low-level helpers and internals:

```tsx
import {
  createPicodashStore,
  picodashPersistedStateSchema,
  usePicodashPanelSelector,
  usePicodashPanelStoreApi,
  usePicodashProviderSelector,
  usePicodashProviderStoreApi,
  normalizeRangeValue,
} from '@picodash/panel/advanced'
```

The provider hooks expose global registration/layout state. The panel hooks use the nearest
rendered `PicodashPanel` context and are intended for low-level custom integrations. Prefer the main
entrypoint's explicit `usePicodashPanelStoreSelector(store, selector)` in application components.

## Known breaking impact

- External consumer `Gearmo` is the known downstream requiring a separate migration path.
- No automatic migrator exists for old schema-driven persistence.
