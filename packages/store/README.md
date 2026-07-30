# @picodash/store

The framework-independent, typed state foundation for one Picodash Panel.

> **Public preview:** The package API is still evolving. See the repository's
> [release policy](https://github.com/programbo/picodash/blob/main/RELEASING.md) before depending
> on a versioned release.

## Create a Store

Declare every field and its reset default when creating the Store:

```ts
import { createPicodashStore } from '@picodash/store'

const scene = createPicodashStore({
  panelId: 'scene-controls',
  fields: {
    bloom: { defaultValue: true },
    exposure: { defaultValue: 1.2 },
    quality: { defaultValue: 'balanced' },
  },
})
```

Primitive defaults infer as `boolean`, `number`, and `string`. Supply an explicit value record for
literal unions or structured values:

```ts
type SceneValues = {
  bloom: boolean
  quality: 'draft' | 'balanced' | 'final'
  viewport: { width: number; height: number }
}

const scene = createPicodashStore<SceneValues>({
  panelId: 'scene-controls',
  fields: {
    bloom: { defaultValue: true },
    quality: { defaultValue: 'balanced' },
    viewport: { defaultValue: { width: 1920, height: 1080 } },
  },
  initialValues: {
    quality: 'final',
  },
})
```

`scene.getState()` exposes the Panel ID and current typed value record. `scene.fields` contains one
stable typed handle per declared field, such as `scene.fields.exposure`. Each handle carries its
typed key and owning Store identity. Values must be JSON-compatible. Defaults and initial values
are cloned when the Store is created, so later changes to caller-owned objects cannot alter Store
state.

This initial package surface does not yet include writes, validation, repair, ordering, adapters,
or React bindings.
