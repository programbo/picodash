# Picodash

A composable React inspector-panel package with application-owned state, synchronous validation contracts, and built-in controls/visualizations.

> **Public preview:** The package API is still evolving. See the repository's
> [release policy](https://github.com/programbo/picodash/blob/main/RELEASING.md) before depending on a versioned release.

The workspace website surface is split by app:

- `apps/web`: Next.js App Router source app for public docs and route-based topology.
- `apps/website`: legacy Vite source app with equivalent route behavior.

`apps/web` route topology:

- `/` and `/gallery` (redirect) render the gallery root.
- `/store`, `/usage`, `/more-examples` render gallery routes.
- `/panel-geometry-lab` renders layout geometry fixtures.
- `/state-lab/{provider,scene,built-in-items,custom-items}` renders state-lab tabs.
- missing paths render the 404 page.

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
    <PicodashProvider theme="system" persistLayout storageKey="my-app:tweaker-layout:v1">
      <PicodashPanel store={sceneStore} title="Scene" defaultPlacement="top-right" width={360}>
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

`defaultPlacement` accepts the existing corner strings or a placement object:

```ts
type PicodashPanelPlacement =
  | { mode: 'floating'; position?: PicodashPanelCorner }
  | { mode: 'magnetic'; position: PicodashPanelSnapPosition }
  | { mode: 'fixed'; position: PicodashPanelFixedPosition }

type PicodashPanelBoundary = Element | React.RefObject<Element | null>
```

`PicodashPanelSnapPosition` replaces the former dock-position name and covers all four edges and
four corners. `PicodashPanelFixedPosition` supports `top-left`, `bottom-left`, `top-right`,
`bottom-right`, `left`, and `right`.

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
    defaultPlacement={{ mode: 'fixed', position: 'left' }}
  />

  <PicodashPanel
    store={canvasStore}
    boundary={canvasRef}
    defaultPlacement={{ mode: 'fixed', position: 'bottom-right' }}
  />
</PicodashProvider>
```

- The viewport is the default boundary. `boundary={null}` explicitly opts a panel out of an
  inherited provider boundary.
- Boundary inputs are direct `Element` values or React refs. CSS selectors are not resolved by the
  package.
- Boundaries control geometry only. `portalContainer` independently controls where panel portals
  render, and fixed panels overlay rather than inset application content.
- Floating panels remain constrained to the effective boundary. Magnetic and fixed placements
  follow its live edges; only panels with the same resolved boundary participate in peer snapping.
- Fixed `left` and `right` panels fill the effective boundary height. Fixed corner panels keep
  content-driven height capped to that boundary.
- Collapsible fixed panels retract into their edge or corner and leave an accessible arrow button
  visible for reopening.
- `usePicodashPanel(panelId).setPlacement(...)` changes placement at runtime. Returning to floating
  restores the last non-fixed coordinates.
- Placement persists with provider layout only when `persistLayout` is enabled. Existing stored
  floating and magnetic layouts continue to hydrate.

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

## Items and layout

`PicodashItem` is the shared row shell for built-in and custom controls.

- `field` binds to store value.
- `id` is required for non-field display rows.
- `contentLayout` is `inline`, `block`, or `full`.
- `PicodashGroup` supports `pin="start"` and `pin="end"` placement bands.
- Fixed panels keep the start and end bands visible while only the auto band scrolls. Floating and
  magnetic panels keep their existing single body scrollport.
- Each panel scrollport includes `scroll-fade` through `@picodash/panel/style.css`; consumers do not need a
  separate shadcn stylesheet import.
- Reorder handles support pointer dragging and keyboard pick-up with Space/Enter, movement with
  Arrow Up/Down, dropping with Space/Enter, and cancellation with Escape.

## Release verification

Pull requests and pushes to `main` run parallel quality and E2E jobs. The quality job runs
`bun audit --audit-level=high`, workspace checks, and unit tests; the E2E job builds the workspace
and runs the Playwright end-to-end suite. Package publication independently runs package checks,
tests, and the build, which includes source maps.

## Themability

- Themes resolve as panel override, provider theme, then `"dark"` fallback.
- Supported provider themes: `"dark"`, `"light"`, `"system"`, plus named custom themes.
- Theme names are emitted through `data-picodash-theme` on provider and portal surfaces.
- `usePicodashTheme()` returns the resolved name for custom controls.

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
