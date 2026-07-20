# Tweaker

A composable React inspector-panel package with application-owned state, synchronous validation contracts, and built-in controls/visualizations.

## Migration boundary

- This package is the promoted API. Old schema-driven specifiers and behavior (`useTweaker` driven registration and old persistence shape) are retired.
- Legacy `panel` imports map to `tweaker` imports in this repository context.
- There is no compatibility package facade and no npm deprecation migration helper here.

## Imports and styles

```tsx
import {
  createTweakerPanelStore,
  TweakerPanel,
  TweakerProvider,
  TweakerGroup,
  useTweakerPanelStoreSelector,
} from 'tweaker'
import 'tweaker/style.css'
```

## Quick start

```tsx
import {
  createTweakerPanelStore,
  TweakerGroup,
  TweakerNumber,
  TweakerPanel,
  TweakerProvider,
  TweakerSelect,
  TweakerSlider,
  TweakerSwitch,
  useTweakerPanelStoreSelector,
} from 'tweaker'
import 'tweaker/style.css'

const sceneStore = createTweakerPanelStore({
  panelId: 'scene',
  initialValues: {
    bloom: true,
    quality: 'balanced',
    exposure: 1.2,
    opacity: 0.72,
  },
})

function ScenePanel() {
  const exposure = useTweakerPanelStoreSelector(sceneStore, (state) => {
    return typeof state.values.exposure === 'number' ? state.values.exposure : 1
  })

  return (
    <TweakerProvider theme="system" persistLayout storageKey="my-app:tweaker-layout:v1">
      <TweakerPanel store={sceneStore} title="Scene" defaultPlacement="top-right" width={360}>
        <TweakerGroup id="render" label="Render">
          <TweakerSwitch field="bloom" label="Bloom" defaultValue={true} />
          <TweakerSlider
            field="exposure"
            label="Exposure"
            defaultValue={1.2}
            min={0.2}
            max={3}
            step={0.05}
            formatOptions={{ style: 'decimal', maximumFractionDigits: 2 }}
          />
          <TweakerSelect
            field="quality"
            label="Quality"
            defaultValue="balanced"
            options={[
              { label: 'Draft', value: 'draft' },
              { label: 'Balanced', value: 'balanced' },
              { label: 'Final', value: 'final' },
            ]}
          />
          <TweakerNumber
            field="opacity"
            label="Opacity"
            defaultValue={0.72}
            min={0}
            max={1}
            step={0.01}
          />
        </TweakerGroup>
      </TweakerPanel>

      <span>Exposure: {exposure}</span>
    </TweakerProvider>
  )
}
```

## Panel store model

- `createTweakerPanelStore({ panelId, initialValues, initialMeta })` creates application-owned store state.
- `TweakerPanel` may render that store via `store` prop.
- `useTweakerPanelStoreSelector` reads store slices without recreating local mirrors.
- Internal-store panels are supported with `TweakerPanel id + initialValues/initialMeta`; this mode is UI-local unless app state is injected.
- `setFieldValue` and `setFieldValues` are strict and atomic.
- `setFieldInput` is the interactive path that may keep non-persisted drafts with validation feedback while preserving canonical values.

## Validation and value contracts

- Field-backed items accept synchronous `parse` and `validate`.
- Standard Schema validators (for example Zod) are supported.
- Promise-valued contracts are rejected.
- Shared fields must pass a common contract chain; all validators are combined.

## JSON-compatible state

All values that cross store boundaries should be JSON-compatible.
Composite objects are allowed only when serializable.
Dropzone media values are metadata records and safe image URLs rather than raw objects.

## Built-ins

- Inputs: `TweakerText`, `TweakerNumber`, `TweakerSlider`, `TweakerSwitch`, `TweakerSelect`, `TweakerSegmented`, `TweakerVector3`, `TweakerRange`, `TweakerXYPad`, `TweakerAlignment`, `TweakerMatrix2D`.
- Media and files: `TweakerDropzone`, `TweakerMediaPreview`.
- Display/derived: `TweakerDisplay`.
- Live visuals: `TweakerSparkline`, `TweakerChart` (typed variants).
- Gradient utility: `TweakerGradient` and rotation-field pairing.

### Sparklines

`data` accepts finite arrays, restartable async iterable factories, or subscription sources.
Use `autoscale` for symmetric shared ranges and `continuous` for sustained streaming while visible.
`maxPoints` controls history retention.

### Charts

`TweakerChart` is a typed discriminated union on `type` and supports only compatible props per variant (`area`, `bar`, `line`, `pie`, `radar`, `radial`).

## Items and layout

`TweakerItem` is the shared row shell for built-in and custom controls.

- `field` binds to store value.
- `id` is required for non-field display rows.
- `contentLayout` is `inline`, `block`, or `full`.
- `TweakerGroup` supports `pin="start"` and `pin="end"` placement bands.

## Themability

- Themes resolve as panel override, provider theme, then `"dark"` fallback.
- Supported provider themes: `"dark"`, `"light"`, `"system"`, plus named custom themes.
- Theme names are emitted through `data-tweaker-theme` on provider and portal surfaces.
- `useTweakerTheme()` returns the resolved name for custom controls.

## Theme token contract

- Spacing and geometry: `--tweaker-space-0-5`, `--tweaker-space-1`, `--tweaker-space-1-5`, `--tweaker-space-2`, `--tweaker-space-2-5`, `--tweaker-space-3`, `--tweaker-space-4`, `--tweaker-space-5`, `--tweaker-radius-surface`, `--tweaker-radius-control`, `--tweaker-control-height-xs`, `--tweaker-control-height-sm`, `--tweaker-control-height-md`, `--tweaker-control-height-lg`, `--tweaker-field-surface-min-height`, `--tweaker-icon-xs`, `--tweaker-icon-sm`, `--tweaker-icon-md`, `--tweaker-icon-lg`, `--tweaker-panel-width`
- Typography primitives: `--tweaker-font-family`, `--tweaker-font-size-xs`, `--tweaker-font-size-sm`, `--tweaker-font-size-md`, `--tweaker-font-size-lg`, `--tweaker-font-size-xl`, `--tweaker-font-size-2xl`, `--tweaker-font-size-3xl`, `--tweaker-line-none`, `--tweaker-line-tight`, `--tweaker-line-normal`, `--tweaker-line-relaxed`, `--tweaker-font-light`, `--tweaker-font-normal`, `--tweaker-font-medium`, `--tweaker-font-semibold`, `--tweaker-tracking-normal`, `--tweaker-tracking-wide`
- Interaction surface tuning: `--tweaker-opacity-disabled`, `--tweaker-opacity-disabled-soft`, `--tweaker-opacity-muted`, `--tweaker-opacity-subtle`, `--tweaker-border-thin`, `--tweaker-shadow-sm`, `--tweaker-shadow-md`, `--tweaker-shadow-panel`, `--tweaker-shadow-viewer`, `--tweaker-shadow-inner`, `--tweaker-duration-fast`, `--tweaker-ease-out`, `--tweaker-blur-surface`, `--tweaker-blur-overlay`
- Layer elevations and z-order: `--tweaker-layer-raised`, `--tweaker-layer-drag`, `--tweaker-layer-tooltip`, `--tweaker-layer-select`, `--tweaker-layer-menu`, `--tweaker-layer-dialog`, `--tweaker-layer-viewer`
- Palette: `--tweaker-color-canvas`, `--tweaker-color-surface`, `--tweaker-color-surface-raised`, `--tweaker-color-surface-muted`, `--tweaker-color-text`, `--tweaker-color-text-strong`, `--tweaker-color-text-muted`, `--tweaker-color-border`, `--tweaker-color-control`, `--tweaker-color-focus`, `--tweaker-color-accent`, `--tweaker-color-accent-text`, `--tweaker-color-success`, `--tweaker-color-info`, `--tweaker-color-warning`, `--tweaker-color-alert`, `--tweaker-color-danger`, `--tweaker-color-overlay`

## Advanced exports

Use `tweaker/advanced` for low-level helpers and internals:

```tsx
import {
  createTweakerStore,
  tweakerPersistedStateSchema,
  useTweakerSelector,
  normalizeRangeValue,
} from 'tweaker/advanced'
```

## Known breaking impact

- External consumer `Gearmo` is the known downstream requiring a separate migration path.
- No automatic migrator exists for old schema-driven persistence.
