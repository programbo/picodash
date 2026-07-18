# panel

A composable React inspector-panel library. It provides an accessible floating panel,
application-owned Zustand stores, built-in JSON-compatible inputs, custom items, and
atomic import/export workflows.

## Quick start

```tsx
import {
  createTweakerPanelStore,
  TweakerPanel,
  TweakerProvider,
  TweakerSlider,
  useTweakerPanelStoreSelector,
} from 'panel'
import 'panel/style.css'

const sceneStore = createTweakerPanelStore({
  panelId: 'scene',
  initialValues: { opacity: 0.5 },
})

export function App() {
  const opacity = useTweakerPanelStoreSelector(sceneStore, (state) => state.values.opacity)

  return (
    <TweakerProvider theme="system">
      <p>Opacity: {String(opacity)}</p>
      <TweakerPanel store={sceneStore} title="Scene" width={360}>
        <TweakerSlider
          defaultValue={0.5}
          field="opacity"
          label="Opacity"
          min={0}
          max={1}
          step={0.01}
        />
      </TweakerPanel>
    </TweakerProvider>
  )
}
```

`TweakerPanel` can instead create its own store:

```tsx
<TweakerPanel
  id="scene"
  initialValues={{ opacity: 0.5 }}
  initialMeta={{ canEdit: true }}
  title="Scene"
/>
```

Internal-store mode requires `id` and accepts `initialValues` and `initialMeta`.
Application-owned mode requires `store`; initialization belongs to
`createTweakerPanelStore`, so those props are unavailable.

## Application-owned state

The panel store is a vanilla Zustand store. Read it in React with
`useTweakerPanelStoreSelector` or use its API from application code:

```ts
sceneStore.getState().setFieldValue('opacity', 0.8)

const result = sceneStore.getState().setFieldValues({
  opacity: 0.65,
  quality: 'final',
})

if (!result.success) console.error(result.errors)
```

`setFieldValue` and `setFieldValues` are strict. They parse and validate the complete
write before changing anything, and a batch commits in one Zustand transaction.
`setFieldInput` is the interactive path used by editors: invalid input is retained in
`fieldState.draftValue` with `fieldState.errors`, while the canonical value remains
unchanged.

`initialValues` seed application state once. An item's `defaultValue` is its reset
baseline; changing a default changes the next reset without overwriting the accepted
value. Successful reset reparses the latest default and clears its draft, errors, dirty,
and touched state.

## Items and groups

`TweakerItem` is the shared shell for built-in and application-defined items. A writable
item requires `field`; its `id` defaults to the field. A display-only item without a
field requires an `id`. Item IDs must be unique across the panel.

```tsx
<TweakerGroup id="rendering" label="Rendering" pin="start">
  <TweakerSlider field="exposure" label="Exposure" min={-2} max={2} />
</TweakerGroup>

<TweakerItem id="frame-chart" contentLayout="block" label="Frame time">
  <FrameChart />
</TweakerItem>
```

Use `pin="start"` or `pin="end"` to keep an item in the corresponding ordering band.
Unpinned items remain in normal flow. Items are draggable only when `reorderable` is
enabled and another visible, reorderable sibling exists in the same parent and pin band.

`contentLayout` accepts `"inline"`, `"block"`, or `"full"`. The custom-item render
function receives the canonical `value`, `fieldState`, `setInput`, input/error IDs,
disabled/read-only state, and `resetValue`.

```tsx
<TweakerItem<string> field="name" defaultValue="Studio" label="Preset name" contentLayout="block">
  {(item) => (
    <input
      id={item.inputId}
      value={
        typeof item.fieldState?.draftValue === 'string'
          ? item.fieldState.draftValue
          : (item.value ?? '')
      }
      aria-invalid={Boolean(item.fieldState?.errors.length)}
      aria-describedby={item.fieldState?.errors.length ? item.errorId : undefined}
      onChange={(event) => item.setInput(event.target.value)}
    />
  )}
</TweakerItem>
```

## Parsing and validation

Field-backed items accept synchronous, library-neutral `parse` and `validate` contracts.
`validate` also accepts a [Standard Schema v1](https://standardschema.dev/) validator, so
Zod works directly:

```tsx
import { z } from 'zod'

const presetName = z.string().trim().min(3).max(24)

<TweakerItem
  field="presetName"
  defaultValue="Studio"
  validate={presetName}
>
  {/* editor */}
</TweakerItem>
```

A parser returns a canonical value, explicit `{ unset: true }`, or errors with an
optional repair:

```ts
const parsePercent = (input: unknown) => {
  const value = typeof input === 'string' ? Number(input) : input
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { success: false, errors: ['Expected a finite percentage.'] }
  }
  return {
    success: true,
    output: { value: Math.min(100, Math.max(0, value)) },
  }
}
```

Parsing runs before validation, and successful Standard Schema output is canonical.
Promise-returning contracts are rejected: asynchronous validation is intentionally not
supported. If several mounted items share a field, all their validators run, errors are
combined, and their parser outputs must agree.

Interactive invalid edits retain a draft and accessible errors. Programmatic invalid
writes do not mutate the store. Imports validate the complete prospective document
atomically. A repairable import or reactive constraint change opens a review dialog;
Accept revalidates and commits once, while Abort preserves the accepted value. Hidden
writable fields participate in import/reset. Display fields are included in copy/export
but cannot be changed by import, reset, or writes.

## Built-in items

- `TweakerNumber`, `TweakerSlider`, `TweakerSwitch`, and `TweakerSelect`
- `TweakerSegmented` and the fixed 3x3 `TweakerAlignment`
- `TweakerVector3`, `TweakerRange`, and `TweakerXYPad`
- `TweakerGradient`
- `TweakerMediaPreview` and `TweakerDropzone`
- `TweakerDisplay` for derived, non-writable output

Composite values remain JSON-compatible. Dropzones store file metadata rather than
`File` objects; media previews use safe image URLs; object URLs are revoked when removed
or unmounted. Reactive bounds/options are part of each built-in field contract, so the
same rules apply to editing, application writes, imports, defaults, resets, and
constraint changes.

`TweakerSlider.marks` accepts `true`, a count of intermediate marks, explicit numbers, or
`{ value, label }` objects. Number and slider items accept
`Intl.NumberFormatOptions` through `formatOptions`.

## Provider and panel configuration

`TweakerProvider` owns cross-panel concerns:

- `theme`: `"dark"`, `"light"`, or `"system"`; default `"dark"`
- `portalContainer`: optional host element for all portaled surfaces
- `persistLayout`: whether panel layout uses local storage; default `true`
- `storageKey`: application-specific layout persistence key

`TweakerPanel` owns panel geometry:

- `defaultPlacement`: `"top-right"`, `"top-left"`, `"bottom-right"`, or `"bottom-left"`
- `width`: pixels or a CSS length
- `collapsible` and `defaultCollapsed`

Every titled panel provides actions to expand/collapse groups, reset fields, and copy,
export, or import JSON/YAML values.

## Exports

The `panel` root exposes consumer components, their value/prop types, validation
contracts, `createTweakerPanelStore`, and selector hooks. Low-level provider/panel hooks,
registration and state types, ordering helpers, storage/theme constants, and pure
normalization/projection helpers live at `panel/advanced`:

```ts
import { TweakerItem, TweakerPanel } from 'panel'
import { normalizeRangeValue, type TweakerPanelState } from 'panel/advanced'
```

There are no `TweakerControl`, `TweakerField`, `fieldId`, `placement`, or panel
`defaultValues` compatibility exports.

## Themes

Import `panel/style.css`. CSS variables are the public override API:

```css
[data-tweaker-theme='dark'] {
  --tweaker-color-accent: oklch(0.78 0.15 172);
  --tweaker-panel-background: oklch(0.19 0.015 250);
  --tweaker-row-hover: oklch(0.3 0.025 250 / 70%);
}
```

The provider carries `data-tweaker-theme` on its portal carrier, and every portaled
panel, menu, dialog, tooltip, and viewer repeats it. CSS owns editable visual values;
JS-only geometry, Motion, and layer tokens are available from `panel/advanced`.

## Development

```bash
vp install
vp test
vp pack
pnpm --filter demo test:e2e
```

The demo defaults to port `6032`. For the API/DX worktree, run it on the reserved
worktree port without changing the canonical default:

```bash
DEMO_PORT=6034 pnpm --filter demo dev
DEMO_PORT=6034 pnpm --filter demo test:e2e
```
