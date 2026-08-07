# Agent-First Picodash with a Compound Dashlet System

## Summary

Reorient Picodash as the fastest reliable way to add flexible, unobtrusive control and monitoring interfaces to React applications.

The release will combine four mutually reinforcing capabilities:

1. A typed `@picodash/store` state engine.
2. Polished Panels and built-in Dashlets from `@picodash/picodash`.
3. A theme-aware composition system for custom compound Dashlets.
4. Shared human/agent guidance, realistic examples, and verifiable implementation workflows.

Public messaging will lead with the outcome—avoiding bespoke control-interface infrastructure—while agent reliability is the implementation mechanism and proof.

Completion means release-ready main. npm publication and production deployment remain separate operations.

## Product and Domain Contract

Create root `PRODUCT.md` covering:

- Primary implementer: an AI coding agent supervised by a human developer.
- Beachhead: adding overlay control and monitoring surfaces to existing React apps.
- Supported environments: React 19 with verified Next.js App Router and Vite workflows.
- Differentiator: reusable state, interaction infrastructure, composition elements, accessibility, placement, validation, theming, persistence, and diagnostics.
- Exposure policy: every host explicitly decides whether Panels are available to developers, authenticated operators, or end users.
- Canonical UX: initially visible, snapped to a corner, collapsible, dismissible, non-layout-shifting, and explicitly reopenable.
- Accessibility target: WCAG 2.2 AA.

Rewrite `CONTEXT.md` in the required glossary format:

- **Dashboard:** the application-level composition of one or more Panels and their Dashlets; not a component.
- **Panel:** an independently placeable container represented by `PicodashPanel`.
- **Dashlet:** a control, readout, visualization, preview, action, or compound item inside a Panel.
- **Compound Dashlet:** one registered Dashlet whose body composes multiple elements and may bind several typed fields while retaining one ordering, visibility, status, and reset boundary.
- **Picodash Store:** the complete state engine for one Panel, including values, contracts, drafts, validation, repair, registration, ordering, collapse, focus, hover, and interaction state.
- Retain precise placement, disposition, boundary, and coordinate terminology.
- Supersede the previous glossary statement that a Dashlet corresponds to `PicodashPanel`.

Add `docs/adr/0001-agent-first-store-and-dashlet-boundaries.md`, recording:

- `@picodash/store` owns the complete per-Panel state engine.
- Typed JSX remains the canonical authoring representation.
- Fields use typed handles rather than string identifiers.
- External state uses whole-record adapters.
- Dashboard remains a composition rather than a component.
- `/dashlet` is the semantic custom-Dashlet layer, while `/ui` remains the lower-level accessible foundation.

Use `apps/web/DESIGN.md` only for the evolved website visual system.

## Package Boundaries

The public package graph becomes:

- `@picodash/store`: typed per-Panel state engine.
- `@picodash/store/react`: React selectors and controlled whole-record bindings.
- `@picodash/picodash`: providers, Panels, built-in Dashlets, actions, and common Store re-exports.
- `@picodash/picodash/dashlet`: semantic theme-aware elements for custom compound Dashlets.
- `@picodash/picodash/ui`: lower-level React Aria foundations.
- `@picodash/picodash/advanced`: advanced provider and Panel integration.
- `@picodash/picodash/catalog`: serializable built-in and composition metadata.
- `@picodash/picodash/style.css`: complete styles and theme recipes.

## `@picodash/store`

Add `packages/store` with its own package manifest, build configuration, README, tests, and release check.

Move the pure state engine from the legacy panel implementation into `packages/store`:

- Values, metadata, field definitions, drafts, errors, and validation.
- Atomic writes, resets, imports, repairs, and JSON compatibility.
- Item registration, multi-field ownership, ordering, collapse, focus, hover, dragging, and active interaction state.
- Pure order and constraint utilities.
- Serializable Panel-document logic that does not require React.

Keep DOM geometry, React contexts, Motion integration, portals, styles, themes, and rendering in `@picodash/picodash`.

### Store API

Introduce:

```ts
createPicodashStore<TValues>(options)
PicodashStore<TValues>
PicodashStoreState<TValues>
PicodashField<TValues, TKey>
PicodashFieldDefinition<TValue>
PicodashValueAdapter<TValues>
PicodashWriteResult
PicodashError
PicodashErrorCode
```

Canonical definition:

```ts
type SceneValues = {
  bloom: boolean
  exposure: number
  quality: 'draft' | 'balanced' | 'final'
}

const scene = createPicodashStore<SceneValues>({
  panelId: 'scene-controls',
  fields: {
    bloom: { defaultValue: true },
    exposure: { defaultValue: 1.2 },
    quality: { defaultValue: 'balanced' },
  },
})
```

Contracts:

- `fields` defines all valid fields and creates stable handles such as `scene.fields.exposure`.
- Primitive defaults widen appropriately; explicit generics or Standard Schema define richer unions and objects.
- Field definitions own reset defaults and durable parsers or validators.
- Mounted Dashlets may add compatible presentation constraints but cannot redefine durable defaults.
- Values and persisted metadata remain JSON-compatible.
- Initial values are validated before replacing defaults.
- Programmatic multi-field writes remain atomic.
- Promise-based validators, adapters, and setters remain unsupported.

### Existing-State Binding

Define a synchronous whole-record adapter with:

- `getSnapshot()`.
- `subscribe(listener)`.
- Atomic `setValues(nextValues, context)`.

All writes—including interaction, reset, repair, and import—must use the same adapter setter.

Invalid host snapshots:

- Never silently replace the last valid Picodash state.
- Produce a stable diagnostic.
- Expose a repair proposal when a valid repair exists.
- Preserve the host as the authoritative source.

Add `@picodash/store/react` for:

- `usePicodashStoreSelector`.
- A Strict Mode-safe whole-record binding for `useState` and `useReducer`.
- Controlled updates delivered as one complete validated value record.

Document verified adapters for Zustand, XState actors, Redux-like stores, and domain stores without adding framework-specific runtime dependencies.

## Store Naming Collision

Reserve `createPicodashStore` and `PicodashStore` for the public per-Panel Store.

Rename the existing advanced provider-wide APIs:

- `createPicodashStore` → `createPicodashProviderStore`.
- Provider-wide Store types → `PicodashProviderStore` and `PicodashProviderState`.

Provider state continues to own cross-Panel visibility, placement, z-order, activation, and layout persistence. The per-Panel Store owns Dashlet values and interaction state.

No compatibility aliases are retained.

## `@picodash/picodash` Breaking API

Make every `PicodashPanel` require an explicit `store`. Remove the internal `id + initialValues + initialMeta` mode.

Rename:

- `createPicodashPanelStore` → `createPicodashStore`.
- `PicodashPanelStore` → `PicodashStore`.
- `PicodashPanelState` → `PicodashStoreState`.
- `usePicodashPanelStoreSelector` → `usePicodashStoreSelector`.

Replace string fields and component-owned defaults:

```tsx
<PicodashSlider field="exposure" defaultValue={1.2} />
```

with typed Store handles:

```tsx
<PicodashSlider field={scene.fields.exposure} />
```

Enforce field/Dashlet compatibility in TypeScript for boolean, numeric, string-union, tuple, object, media, and visualization values.

Custom single-field Dashlets continue to use `PicodashItem`, now with a typed field handle.

## Multi-Field Compound Dashlets

Extend `PicodashItem` with a `fields` prop mutually exclusive with singular `field`.

```tsx
<PicodashItem
  id="render-health"
  label="Render health"
  contentLayout="full"
  fields={{
    fps: { field: monitor.fields.fps, mode: 'display' },
    frameBudget: monitor.fields.frameBudget,
    throttled: monitor.fields.throttled,
  }}
>
  {({ fields }) => (
    // custom compound Dashlet
  )}
</PicodashItem>
```

Contracts:

- The object keys are local typed aliases used by the child function.
- A bare handle means writable input mode.
- `{ field, mode: 'display' }` creates a read-only display binding.
- `id` is required for multi-field and fieldless custom Dashlets.
- Each returned field context exposes:
  - Typed canonical value.
  - Draft value where applicable.
  - Errors and touched state.
  - Stable input, label, and error IDs.
  - `setInput` for writable bindings.
  - `reset`.
- Display bindings do not expose `setInput` at the type level.
- The outer item is one reorder, visibility, status, active, focus, and reset boundary.
- Reset affects every writable field registered by the compound Dashlet.
- Import/export includes all registered input and display fields, while only input fields may mutate.
- Duplicate handles, conflicting modes, and incompatible shared contracts produce stable diagnostics.
- Several Dashlets may intentionally share a field when their contracts remain compatible.

Render children remain appropriate here because the parent must supply typed state and actions back to the custom composition.

## `@picodash/picodash/dashlet`

Add a dedicated entrypoint for semantic compound-Dashlet anatomy.

Canonical usage:

```tsx
import * as Dashlet from '@picodash/picodash/dashlet'
```

This preserves readable composition such as `Dashlet.Frame` while retaining static module exports and tree shaking.

### Anatomy

- `Frame`
- `Header`
- `Heading`
- `Description`
- `Actions`
- `Body`
- `Footer`
- `Toolbar`

### Readouts

- `Metric`
- `MetricLabel`
- `MetricValue`
- `MetricTrend`
- `Status`
- `StatusIndicator`

### Structured Data

- `DataList`
- `DataRow`
- `DataLabel`
- `DataValue`

### Visualization

- `Surface`
- `Caption`
- `Legend`
- `LegendItem`
- `LegendSwatch`

### States

- `EmptyState`
- `LoadingState`
- `ErrorState`

Move and rename the existing composition primitives:

- `ItemSurface` → `Surface`.
- `ItemCaption` → `Caption`.
- `ItemLegend` → `Legend`.
- `ItemLegendItem` → `LegendItem`.
- `ItemLegendSwatch` → `LegendSwatch`.
- `ItemEmptyState` → `EmptyState`.

Remove them from `/ui`; do not retain aliases.

### Composition Rules

- Components use children rather than `renderHeader`, `showActions`, or similar prop proliferation.
- Finite semantic variants such as tone, density, orientation, alignment, and emphasis are allowed.
- The anatomy does not own application state; it consumes typed contexts supplied by `PicodashItem` or ordinary props.
- `Frame` is the visual root inside the registered `PicodashItem`; it does not create a second item registration.
- Parts remain optional and nest predictably.
- Every component exports a named `*Props` type.
- Every component emits stable semantic `data-slot` attributes.
- Internal `cva` helpers and variant functions remain private.
- High-frequency visualization samples remain outside persisted Store values.

## `@picodash/picodash/ui`

Keep `/ui` as the accessible React Aria foundation.

Add only the missing foundations required by compound Dashlets:

- `Meter`, `MeterTrack`, and `MeterFill`.
- `ProgressBar`, `ProgressTrack`, and `ProgressFill`.
- `Toolbar`.

Continue to provide existing buttons, toggles, fields, inputs, cards, tabs, menus, dialogs, tooltips, selects, sliders, and overlays.

Rules:

- Preserve React Aria prop names and interaction states.
- Preserve keyboard, pointer, touch, screen-reader, and focus-visible behavior.
- Visible labels are preferred; otherwise accessible names are required.
- Root overlays preserve provider portal, theme carrier, and stacking contracts.
- Nested menus and overlays inherit their parent container rather than reusing the provider’s full-screen portal.
- Every public element has a named props type.
- `/ui` does not grow into a general application component library in this release.

## Theme Contract

All `/dashlet` and `/ui` components must:

- Work with built-in dark, light, and system themes.
- Inherit custom `data-picodash-theme` recipes.
- Use semantic public `--picodash-*` roles.
- Use existing surface, text, border, control, well, status, data, spacing, typography, radius, shadow, focus, duration, and opacity roles.
- Derive component-private values from public semantic tokens when a new internal role is needed.
- Avoid host tokens such as `bg-muted`, `border-input`, and `var(--chart-*)`.
- Avoid requiring consumer Tailwind source scanning.
- Expose component variants and semantic CSS variables rather than implementation classes.
- Preserve Panel-level theme overrides through portaled overlays.

Add new public tokens only when no existing semantic role expresses the requirement. Do not add tokens merely to mirror every component part.

## Dismiss and Reopen APIs

Add:

```tsx
<PicodashPanelTrigger store={scene}>Scene controls</PicodashPanelTrigger>
```

and a multi-Panel launcher accepting explicit `{ store, label }` entries.

Contracts:

- A trigger activates and raises its Panel by default.
- An explicit action may request toggle behavior.
- Trigger and launcher labels must be accessible.
- Closing or hiding a focused Panel restores focus to its most recently used trigger or launcher entry.
- No automatic floating launcher is rendered.
- Development diagnostics warn when a dismissible Panel has no reopening affordance.
- `close` and `collapsible` remain explicit.
- Canonical examples use snapped top-right placement.

## Diagnostics

Export stable `PicodashErrorCode` and structured diagnostics covering:

- Missing provider.
- Missing stylesheet.
- Duplicate Panel or item IDs.
- Incompatible field and Dashlet types.
- Invalid or asynchronous contracts.
- Invalid adapter snapshots.
- Rejected or non-synchronous writes.
- Dismissible Panels without triggers.
- Invalid compound field maps.
- Duplicate or conflicting compound bindings.
- Missing accessible labels.
- Invalid imports and failed atomic writes.

Messages must identify the offending field, item, or component; state the expected contract; explain the correction; and link to versioned documentation.

## Machine-Readable Catalog

Expand `@picodash/picodash/catalog` to describe:

- Built-in Dashlets.
- `/dashlet` anatomy and composition elements.
- `/ui` foundations relevant to Dashlets.
- Compatible field/value kinds.
- Input, display, streaming, and action capabilities.
- Allowed or recommended nesting.
- Required accessible names.
- Important props and variants.
- Theme/token requirements.
- Reference-document anchors.
- Representative recipe identifiers.

Use this catalog as the source for:

- Website references.
- Agent component selection.
- `llms.txt` indexes.
- Evaluation rubrics.
- Export consistency tests.

## Custom Compound-Dashlet Guidance

Add a complete documentation path.

### Tutorial

Build a real application-health compound Dashlet using:

- Multiple typed fields.
- Display and input bindings.
- Metric, status, progress, visualization, and action elements.
- Loading, error, and recovery states.
- A custom light/dark theme verification step.

### Decision Guide

Explain when to use:

- A built-in Dashlet.
- A custom single-field Dashlet.
- A multi-field compound Dashlet.
- A `PicodashGroup` containing several independently registered Dashlets.

### Anatomy Guide

Cover:

- One registration boundary.
- Header, body, actions, footer, and states.
- Semantic DOM structure.
- Responsive density.
- Avoiding nested interactive controls and boolean-prop APIs.

### State Guide

Cover:

- Typed single and multi-field bindings.
- Input versus display mode.
- Defaults, validation, drafts, errors, and repair.
- Reset and import/export behavior.
- Existing-state adapters.
- Structured object values versus several independent fields.
- Keeping streaming and animation samples outside persisted Store state.

### Theme Guide

Cover:

- Semantic token roles.
- Custom theme recipes.
- Provider and Panel inheritance.
- Portal behavior.
- Component variants and sizes.
- Safe escape hatches.
- Prohibition on host-only Tailwind tokens and internal variant helpers.

### Accessibility Guide

Cover:

- Visible labels and accessible names.
- Field description and error association.
- Meter and progress semantics.
- Toolbar keyboard behavior.
- Status announcements.
- Empty, loading, error, stale, disconnected, and recovery states.
- Focus order, focus restoration, target sizes, contrast, reduced motion, and keyboard/pointer parity.

### Tested Recipes

Ship compiled recipes for:

- Performance health: metrics, trend, status, and sparkline.
- Media transport: mode, progress, actions, and current state.
- Deployment status: structured rows, progress, failures, and recovery action.
- Application-specific compound control: several typed writable fields.

All snippets must compile against the public package and be reused by the site or fixtures rather than existing as unchecked strings.

## Agent Skill

Extend the vendor-neutral skill to make custom Dashlet selection deterministic:

1. Inspect the requested behavior and state ownership.
2. Prefer a built-in Dashlet when it covers the job.
3. Choose a custom single-field Dashlet for one typed value.
4. Choose a compound Dashlet when one semantic unit needs several fields or elements.
5. Use `PicodashGroup` instead when controls need independent ordering, reset, visibility, or status.
6. Start from `/dashlet` anatomy.
7. Pull interactive primitives from `/ui`.
8. Bind fields through the typed `field` or `fields` API.
9. Use semantic tokens and component variants.
10. Implement loading, empty, error, disconnected, and recovery states where applicable.
11. Verify themes, keyboard behavior, focus, labels, errors, close/reopen behavior, desktop/mobile layout, and console diagnostics.

The skill, copyable prompt, npm guidance, and LLM indexes route to the canonical documentation rather than duplicating it.

## Website

Preserve Picodash’s dark, technical, live-code identity while rebuilding its information architecture.

The homepage will contain:

1. A real host-app scene with an operating, dismissible Panel.
2. “Explore demo” as the primary action.
3. Copy-agent-prompt, install, and docs as secondary actions.
4. Three realistic scenarios:
   - Creative controls.
   - Application monitoring.
   - Debug and feature controls.
5. Custom compound Dashlets featured in every scenario rather than only built-in control rows.
6. Live typed implementation code using Store field handles and `/dashlet` composition.
7. A Dashboard → Panel → Dashlet explanation.
8. The native Store versus existing-state adapter decision.
9. Reliability proof covering types, themes, accessibility, diagnostics, fixtures, and agent evaluations.

Do not simulate an AI conversation or invent customers, adoption counts, testimonials, or benchmarks.

### Documentation Routes

Add:

- `/docs/get-started/agent`
- `/docs/get-started/manual`
- `/docs/concepts/*`
- `/docs/guides/custom-dashlets`
- `/docs/guides/compound-dashlets`
- `/docs/guides/dashlet-themes`
- `/docs/guides/dashlet-accessibility`
- `/docs/reference/store`
- `/docs/reference/panel`
- `/docs/reference/dashlets`
- `/docs/reference/dashlet-components`
- `/docs/reference/ui`
- `/docs/reference/diagnostics`
- `/examples`

Redirect existing public routes to their closest new homes, including `/usage/components` to the Dashlet/component reference.

## Evaluation Fixtures

Provide three versioned agent scenarios:

- Next.js creative controls using React-owned state and a custom compound control.
- Vite application monitor using the native Store, metrics, statuses, progress, and streaming visuals.
- Next.js debug/feature controls using an external adapter, explicit exposure policy, actions, and a launcher.

Each includes:

- A seed app without Picodash.
- Vendor-neutral prompt.
- Deterministic acceptance tests.
- Scoring rubric.
- Expected state, exposure, theming, accessibility, and verification decisions.

Manual release evaluations run coding agents against clean seed copies. CI runs deterministic tests only.

## Migration

Migrate `apps/web`, `apps/lab`, package tests, examples, and documentation:

1. Create explicit typed Stores.
2. Move defaults and durable validators into field definitions.
3. Replace string fields with handles.
4. Replace old selector and type names.
5. Rename provider-wide Store APIs.
6. Replace internal-store Panels.
7. Move `Item*` composition imports from `/ui` to renamed `/dashlet` elements.
8. Refactor raw custom-Dashlet markup to the new semantic anatomy.
9. Remove host-only token use inside package-consumer examples.
10. Add triggers to dismissible Panels.
11. Preserve existing placement, persistence, action, theme, portal, and keyboard behavior.

No deprecated aliases are retained.

## Tests and Acceptance

### Pure Type and Store Tests

- Field handles infer valid keys and values.
- Incorrect field/Dashlet combinations fail compilation.
- Compound field maps infer every alias correctly.
- Display bindings omit setters.
- Duplicate and incompatible field maps fail predictably.
- Multi-field reset, import/export, drafts, validation, and repair work atomically.
- External adapters receive one complete validated record.
- Interaction, ordering, focus, hover, and collapse survive Store extraction.
- Pure tests own deterministic Store behavior, parsers, validators, document transforms, placement
  calculations, ordering constraints, and serialization. They do not render React or duplicate
  browser journeys.

### Component Tests

- Every `/dashlet` and `/ui` export has a named props type.
- Canonical namespace imports remain tree-shakeable.
- Anatomy emits stable semantic slots.
- Metric, status, data, progress, toolbar, and state elements have correct semantics.
- Compound Dashlets retain one item registration.
- Built-in dark/light and generic custom themes style every element.
- Components do not depend on host Tailwind tokens.
- Root and nested overlays preserve portal and theme behavior.
- Importing `/dashlet` does not pull chart, dropzone, or unrelated heavy implementations into the bundle.
- Component tests own React registration and context contracts, semantic DOM and ARIA output, event
  wiring, diagnostics, theme propagation, and focused overlay behavior that does not depend on real
  layout. They do not reproduce Store matrices or full user journeys.

### Contract Lab

Replace the collection of scenario-specific Lab routes with one combined-canvas Contract Lab at
`/lab`. Presets are application state, not routes: the Lab does not use search parameters, hashes,
or hidden route variants to select a scenario. The active preset is retained for the browser
session so reloads preserve the current working canvas without creating a durable user preference.

The canvas has three deliberately separate host surfaces:

1. A stable **Lab Console Panel** in its own `PicodashProvider`. It selects presets, invokes
   operations, and controls the primary Specimen Panel plus an optional Peer Panel. Preset changes
   may replace the specimen Stores and contents, but must not unmount, move, or restyle the Console.
2. A specimen provider containing the primary **Specimen Panel** and, only when the preset needs
   cross-Panel behavior, a **Peer Panel**. This is the product surface under test.
3. Host-owned chrome outside both providers: an explicit reopen trigger for the primary Specimen
   Panel and an independent status strip reporting preset, readiness, last operation, and diagnostics.
   Closing, hiding, deregistering, or breaking the specimen must not remove either host surface.

Ship exactly six named presets, each combining related contracts on one canvas:

- `placement`: floating, fixed, and hybrid placement; snaps, docks, boundaries, persistence, and
  detach resistance.
- `interaction`: pointer and keyboard reorder, pin bands, collapse, focus, hover, activation,
  close, reopen, deregistration, and focus restoration.
- `composition`: built-in, single-field, multi-field compound, grouped, input, display, streaming,
  action, loading, empty, error, disconnected, and recovery Dashlets.
- `overlays`: action menus, nested submenus, dialogs, tooltips, selects, portals, stacking, dismissal,
  focus containment, and theme inheritance.
- `documents`: canonical Panel documents, valid and invalid drafts, atomic writes and resets,
  import/export, repair review, external adapters, persistence, diagnostics, and multi-Panel
  isolation.
- `themes`: dark, light, system, generic custom themes, Panel overrides, semantic states, contrast,
  zoom, reduced motion, and portaled theme carriers.

Expose a Lab-only hybrid test driver:

```ts
window.__PICODASH_LAB__ = {
  version: 1,
  loadPreset(preset),
  reset(),
}
```

`loadPreset` and `reset` provide deterministic setup for browser tests and update the same
application state as the visible Console controls. Tests use them to enter a known state, then
exercise and assert the public UI. The driver must not expose Store internals, geometry mutation,
synthetic interaction shortcuts, or assertion-only state. It is absent from production website
bundles. Readiness and outcomes remain observable through the independent status strip and public
DOM.

Delete superseded Lab routes, fixtures, helpers, and tests when their contracts move to this canvas.
Do not retain a legacy route quarantine, compatibility redirects, or a second hidden browser suite.

### Lab Browser Contracts

Browser tests own only behavior requiring a real browser: computed geometry, pointer capture and
dragging, keyboard focus traversal and restoration, portal stacking, scroll and viewport behavior,
media-query themes, reduced motion, zoom, and complete cross-surface flows. Pure Store matrices stay
in pure tests; render and ARIA permutations stay in component tests.

Keep the Lab browser suite at no more than 40 tests. Prefer one preset load followed by a cohesive
contract journey over repeating setup for every assertion. Cover all six presets, the four tested
recipes, desktop and mobile boundaries, keyboard and pointer parity, close/reopen behavior, compound
input/display/reset/repair/import/export, and absence of unexpected console errors or Picodash
diagnostics. The cap is a design constraint: move deterministic coverage down a layer instead of
raising it.

### Website Browser Journeys

Keep public website journeys separate from the Contract Lab. They cover homepage scenarios at
desktop and mobile sizes, documentation navigation, redirects, prompt copying, catalog references,
and the public examples' no-error baseline. They do not import Lab presets or use
`window.__PICODASH_LAB__`.

The Lab and website have independent E2E commands, Playwright projects, server lifecycles, and CI
jobs. Either suite can run and fail without starting or masking the other. Pull-request CI reports
their results separately, while the release gate requires both.

### Repository Gate

Update `bun run ready` to include:

- `@picodash/store` build, check, tests, and release check.
- `@picodash/picodash` build, check, tests, and release check.
- Documentation and generated-agent-artifact drift checks.
- Next.js and Vite fixture builds.
- Workspace checks and tests.
- The independent Contract Lab browser suite, including accessibility checks and the 40-test cap.
- The independent public website journey suite.
- High-severity dependency audit.

Run the website design detector once after the completed UI implementation, followed by desktop and mobile visual inspection.

## Explicit Non-Goals and Assumptions

- Clean pre-v1 break; no aliases or compatibility facade.
- React 19 and modern evergreen browsers are the runtime baseline.
- Dashboard remains a composition, not a component.
- `/ui` does not become a general application design system.
- Compound Dashlets are one registered item, not a synonym for a group of Dashlets.
- Runtime AI, MCP, code generation, declarative Panel schemas, non-React frameworks, async validation, live-agent CI, and simulated AI output remain excluded.
- Documentation and built-in copy remain English-only in this pass.
- WCAG 2.2 AA is a target, not a claim of third-party certification.
- Existing placement, boundary, persistence, theme, action-menu, and portal capabilities remain supported.
- Generated `dist` files are never edited directly.
- npm publication and production deployment require separate explicit authorization.
