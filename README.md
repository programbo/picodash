# Tweaker

Monorepo for the promoted [Tweaker] package and its web showcase (`apps/website`).

## Active product topology

- `packages/tweaker`: published package API for application-owned inspector panels.
- `apps/website`: landing, `/gallery`, and `/state-lab` demo surfaces built with the promoted package.
- Legacy `/demo` integration and old schema-driven API are not part of this workspace and should not be documented as active APIs.

## Breaking migration notes

- Legacy panel imports and specs now map to `tweaker` imports. The prior schema-driven `useTweaker` API and its persistence contracts are retired and are not migrated.
- If your app imported `panel` in this workspace, map it directly to `tweaker` specifiers (`tweaker`, `tweaker/advanced`, `tweaker/style.css`).
- External consumer `Gearmo` is a known breaking downstream that requires its own migration planning and coordination.

## Install and style import

```bash
bun add tweaker
```

```tsx
import 'tweaker/style.css'
```

## Quick start

```tsx
import {
  createTweakerPanelStore,
  TweakerPanel,
  TweakerProvider,
  TweakerSlider,
  TweakerSwitch,
  TweakerText,
  useTweakerPanelStoreSelector,
} from 'tweaker'
import 'tweaker/style.css'

type SceneState = {
  bloom: boolean
  exposure: number
  quality: 'draft' | 'balanced' | 'final'
}

const sceneStore = createTweakerPanelStore<SceneState>({
  panelId: 'scene-controls',
  initialValues: { bloom: true, exposure: 1.2, quality: 'balanced' },
})

export function App() {
  const exposure = useTweakerPanelStoreSelector(sceneStore, (state) => {
    return typeof state.values.exposure === 'number' ? state.values.exposure : 1
  })

  return (
    <TweakerProvider persistLayout storageKey="my-app:tweaker-layout:v1" theme="system">
      <main style={{ filter: `blur(${exposure * 0.2}px)` }}>Scene preview</main>

      <TweakerPanel
        store={sceneStore}
        title="Scene"
        collapsible
        defaultPlacement="top-right"
        width={360}
      >
        <TweakerSwitch field="bloom" label="Bloom" defaultValue={true} />
        <TweakerSlider
          field="exposure"
          label="Exposure"
          defaultValue={1.2}
          min={0.2}
          max={2.5}
          step={0.05}
        />
        <TweakerText
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
      </TweakerPanel>

      <p>Current exposure: {exposure}</p>
    </TweakerProvider>
  )
}
```

## Promoted API surface

All package usage should be built on `TweakerProvider` + panel stores.

- Store ownership and strict writes: `createTweakerPanelStore`, `setFieldValue`, `setFieldValues`.
- UI controls and panels: `TweakerPanel`, `TweakerItem`, and built-in inputs/visualization components.
- State selectors: `useTweakerPanelStoreSelector`.
- Validation contracts: synchronous `parse`/`validate` per field and optional Standard Schema validators.
- Advanced tools: `tweaker/advanced` for internals, helpers, ordering and persistence wiring.
- Styling import: `import 'tweaker/style.css'`.
- No separate dist stylesheet import should be documented (the package export maps that path).

### JSON-compatibility rule

Panel values, storage payloads, imports/exports, and custom metadata must remain JSON-compatible.
File metadata must be plain objects, and derived/high-frequency renderers should remain non-authoritative to the panel store.

### Import and export

Panel copy/export utilities are table-driven from panel registration.
Display-only fields are included in copies/exports.
Repairs from imports and constraint propagation are reviewable through the built-in repair workflow and are committed only after acceptance.

### Validation and reactive behavior

- Synchronous `parse` and `validate` are enforced before any mutation.
- Promise-based parsers and validators are not supported.
- Field metadata changes (for example `min`, `max`, `options`, `readOnly`, `hidden`, labels/help/status) can be passed from state and re-registered; values are normalized to the active contract.

### Built-ins (high-level)

- Text/number/select/switch controls and grouped compositions.
- Visual components: `TweakerSparkline`, `TweakerChart`, `TweakerGradient`, `TweakerMediaPreview`, `TweakerDropzone`.
- Spatial and matrix controls, range/vector controls, and display/readout rows.
- Charts are typed through discriminated variants (`type: 'line' | 'bar' | 'area' | 'pie' | 'radar' | 'radial'`).

## Documentation targets to keep aligned

- `README.md`: workspace setup, installation, runbook, topology.
- `packages/tweaker/README.md`: API, usage patterns, and feature behavior.
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
bun run --filter tweaker check
bun run --filter tweaker test
bun run --filter tweaker build
bun run --filter website test:e2e
bun run ready
```

`bun run ready` remains the full verification gate:

```bash
vp check && vp run -r test && vp run -r build && bun run --filter website test:e2e
```
