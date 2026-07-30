# @picodash/store

The framework-independent, typed per-Panel state engine for Picodash.

> **Public preview:** The package API is still evolving. See the repository's
> [release policy](https://github.com/programbo/picodash/blob/main/RELEASING.md) before depending on a versioned release.

## What this package owns today

`@picodash/store` owns typed values, contracts, mutation semantics, and repair
proposals for one Panel:

- fields and stable handles (`store.fields.<key>`),
- JSON-compatible state with defaults and optional initial values,
- synchronous `parse` / `validate` contracts (including Standard Schema validators),
- strict single and atomic multi-field writes,
- interactive draft tracking via `setFieldInput`,
- reset and repair workflows,
- strict subscription and selector access.

`@picodash/panel` integrations (typed handles in built-ins, adapter wiring,
and compound Dashlet field orchestration) are currently being migrated from
string-field, in-panel wiring; that layer is intentionally documented as the
next phase.

## Quick start

```ts
import { createPicodashStore } from '@picodash/store'

const sceneStore = createPicodashStore({
  panelId: 'scene-controls',
  fields: {
    bloom: { defaultValue: true },
    exposure: { defaultValue: 1.2 },
    quality: { defaultValue: 'balanced' },
  },
  initialValues: {
    quality: 'final',
  },
})

const state = sceneStore.getState()
```

```ts
type SceneValues = {
  bloom: boolean
  quality: 'draft' | 'balanced' | 'final'
  viewport: { width: number; height: number }
}

const monitorStore = createPicodashStore<SceneValues>({
  panelId: 'monitor',
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

## API surface (shipped)

```ts
sceneStore.fields.exposure.key
sceneStore.fields.quality
sceneStore.ownsField(sceneStore.fields.exposure)
sceneStore.subscribe((next, previous) => { ... })
sceneStore.getInitialState()
sceneStore.getState()
const sceneState = sceneStore.getState()

sceneState.setFieldValue(sceneStore.fields.bloom, false)
sceneState.setFieldInput(sceneStore.fields.exposure, '2.0')
sceneState.setFieldValues({
  bloom: true,
  exposure: 1.5,
})
sceneState.resetFieldValue(sceneStore.fields.quality)
sceneState.resetFields()
sceneState.acceptRepairProposal()
sceneState.abortRepairProposal()
```

- `createPicodashStore` returns a frozen API and `getState()` read surface.
- Store methods are synchronous and non-async.
- Promise-based parsers/validators are rejected with clear validation errors.
- `setFieldValues` validates all candidates before any mutation.
- `getInitialState` and `getState` are initially identical in this release,
  preserving SSR-safe startup state.

## Validation contract

A field definition accepts:

- `defaultValue` (required),
- optional `parse` (returns `{ success, output|errors, repair? }`),
- optional `validate` (function validator or `Standard Schema v1` object).

Outputs and initial values are cloned for JSON compatibility on storage boundaries.
The `repair` path marks unresolved values as pending and can be:

- accepted with `acceptRepairProposal()`,
- or reverted with `abortRepairProposal()`.

`setFieldInput` stores draft values while preserving canonical validation state.

## React helper

Import from `@picodash/store/react` for typed selector subscriptions:

```ts
import { usePicodashStoreSelector } from '@picodash/store/react'
```

## Migration alignment

Canonical agent-first direction in this repo still treats:

- `@picodash/store` as the per-Panel state foundation,
- `@picodash/panel` as the rendering, registry, and surface layer,
- typed field-handles in panel built-ins and compound Dashlets as migration work
  tracked in `docs/internal/e2e-migration-ledger.md`.

## Further docs

- [PRODUCT.md](../../PRODUCT.md)
- [CONTEXT.md](../../CONTEXT.md)
- [TESTING.md](../../TESTING.md)
- [agent-first-plan.md](../../agent-first-plan.md)
