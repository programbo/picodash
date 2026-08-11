# Picodash Testing Policy

This document is the canonical ownership and admission policy for Picodash tests. A contract has
one primary owner. Higher layers may prove that layers integrate, but they must not repeat a lower
layer's input matrix.

## Canonical ownership

| Owner                  | Location                                                             | Owns                                                                                                                                                                                                                                                                                                                                                                            | Does not own                                                                                                                                  |
| ---------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Nexus pure tests       | `packages/nexus/tests`                                               | Types and field-handle inference; values, drafts, errors, validation, repair, atomic writes, resets, document objects/plans, persistence serialization, adapters, entity/relationship registration, metadata codecs/commands, and binding interaction state                                                                                                                     | Product ordering reconciliation, collapse presentation, React rendering, browser I/O, DOM/ARIA, CSS, pointer choreography, or website content |
| Agent Dev Bridge tests | `packages/dev-bridge/tests` and `apps/lab/scripts/dev-host.test.mjs` | Relay authentication, disclosure/write enforcement, session generations, CLI protocol/exit behavior, and the Contract Lab dev-host credential/lock lifecycle                                                                                                                                                                                                                    | Nexus invariants, product rendering, or public website journeys                                                                               |
| Shared UI tests        | `packages/ui/src`                                                    | Theme/density resolution; shared primitive props, semantic DOM, ARIA, and deterministic interaction; DashHeader composition; public token and package export contracts                                                                                                                                                                                                          | Nexus facts, Panel/List behavior, browser layout, or integrated facade behavior                                                               |
| DashPanel tests        | `packages/dashpanel/src`                                             | Panel exports, catalog entries, and named prop types; React registration and contexts; component rendering; semantic DOM and ARIA; event wiring; diagnostics; theme carriers; modal projection; overlay behavior that does not need real layout; package-owned pure geometry                                                                                                    | Nexus behavior matrices, computed browser layout, or public website journeys                                                                  |
| DashList tests         | `packages/dashlist/src`                                              | List/Dashlet exports, catalog entries, and prop types; declarations, bindings, groups, ordering reconciliation, collapse presentation, resets, scope-document JSON codec/dialog composition, semantic DOM/ARIA, deterministic reorder interaction, and responsive/rail behavior                                                                                                 | Nexus plan/transaction matrices, DashPanel placement, browser clipboard/file I/O, or public journeys                                          |
| Contract Lab E2E       | `apps/lab/tests`                                                     | Only browser seams: computed geometry, pointer capture and dragging, keyboard focus traversal and restoration, portal stacking, scrolling and viewport changes, browser persistence, media-query themes, reduced motion, zoom, and cohesive cross-surface workflows; the bridge dogfood journey owns browser-to-agent discovery, mutation, wait, and reload-generation behavior | Pure Nexus matrices, type tests, render/ARIA permutations, catalog inventories, or website navigation                                         |
| Website E2E            | `apps/web/tests`                                                     | Public journeys: homepage scenarios at desktop and mobile sizes, documentation navigation, redirects, prompt copying, catalog references, and the public examples' no-error baseline                                                                                                                                                                                            | Contract Lab presets, package permutations, internal style details, or `window.__PICODASH_LAB__`                                              |

Code location does not decide ownership. For example, a shared primitive reexported by Picodash is
verified by UI tests, deterministic Panel placement math belongs in DashPanel tests, and the result
of dragging a rendered Panel against a real boundary belongs in the Contract Lab.

Type failures are compile-time contracts. Prefer positive type inference plus `@ts-expect-error`
cases in the owning package's test compilation; do not open a browser to prove them.

## Browser admission and deletion rubric

A proposed browser assertion is admitted only when all of the following are true:

1. It depends on a browser capability that a pure or component test cannot faithfully provide:
   real layout or computed style, pointer capture, focus traversal/restoration, portal stacking,
   scroll/viewport behavior, browser persistence, media queries, reduced motion, zoom, or a complete
   public journey.
2. It drives public UI after deterministic setup and asserts a user-observable DOM, accessibility,
   download, clipboard, URL, or status-strip outcome.
3. It protects a distinct contract not already proved by a lower layer or another journey.
4. Its assertions fit a cohesive preset or website journey without creating a permutation test.

The browser is refused for parsers, validators, reducers, serialization, ordering matrices,
geometry calculations, prop/type combinations, static export lists, semantic DOM/ARIA that a
component renderer can inspect, or implementation-only class and pixel snapshots. Move those
contracts to the Nexus or Panel owner.

Delete or merge a browser test when its only remaining value is duplicated below the browser,
superseded by the new API or website, tied to a deleted Lab route, or covered by a broader admitted
journey. A cutover change must:

- identify the replacement owner and test in
  `docs/internal/e2e-migration-ledger.md`;
- land the replacement before, or in the same change as, deletion;
- run the narrow replacement and affected browser journey;
- remove the old test, fixture, selector, route, and helper in the same cutover; and
- update the ledger if the final target differs from its planned disposition.

There is no legacy, slow, quarantine, or nightly suite. Do not use `test.skip`, `test.fixme`,
conditional CI exclusion, a hidden route, a second Playwright config, or a retry-only lane to retain
uncertain coverage. An admitted contract runs in the normal pull-request suite; otherwise move,
merge, fix, or delete it.

## Selector policy

Select the same surface a user or assistive technology uses:

1. `getByRole(role, { name })`.
2. `getByLabel(label)` for form fields and independent status/output regions.
3. `getByText` only for visible copy that is itself the contract.
4. A stable semantic `data-*` hook only for a canvas, Panel/item identity, geometry shell, theme
   carrier, or status value that has no suitable accessible role.

Use exact roles and accessible names when ambiguity would hide a regression. Scope locators to a
named Panel, group, dialog, menu, or region before selecting repeated controls. Do not select by
Tailwind utility, generated class, DOM depth, `nth()` ordering, visual color, or internal Nexus
shape. A `data-slot` may verify a public semantic slot; it is not the default interaction selector.
Lab-only status outputs must have stable accessible labels.

## The single Contract Lab

The only Lab route is `/lab`. Presets are application state, never path segments, search
parameters, hashes, or hidden fixture variants. The canvas contains:

- a stable Lab Console Panel in its own provider;
- a specimen provider with a primary Specimen Panel and an optional Peer Panel; and
- host-owned reopen controls and an independent, labelled status strip.

Exactly six presets are supported: `placement`, `interaction`, `composition`, `overlays`,
`documents`, and `themes`. Preset changes may replace specimen Nexuses and content but must not
unmount, move, or restyle the Console. Closing, hiding, deregistering, or breaking a specimen must
not remove the host reopen control or status strip. The active preset may survive reload for the
browser session; no preset is encoded in a route or durable user preference.

Superseded Lab routes and fixtures are deleted during cutover. They are not redirected or retained
as compatibility aliases.

## Hybrid Lab driver

The Lab exposes one setup seam:

```ts
window.__PICODASH_LAB__ = {
  version: 1,
  loadPreset(preset),
  reset(),
}
```

The driver is "hybrid" because visible Console controls and programmatic setup dispatch through the
same Lab application state. It is not a back door into product state.

Each Lab test starts at `/lab`, waits for the labelled status strip to report readiness, calls
`reset()` and `loadPreset()` only to establish a deterministic preset, and waits for the same public
readiness signal again. The test then interacts through roles and labels and asserts the public DOM,
status strip, downloads, clipboard, focus, geometry, or browser state.

The driver must not expose Nexus internals, set geometry, synthesize drag/reorder outcomes, bypass
validation, return assertion-only state, or exist in production website bundles. Operations beyond
`loadPreset` and `reset` use visible Console controls. Readiness, last operation, and diagnostics
remain independently observable when the specimen is unavailable.

## Browser suite shape and ceiling

The Contract Lab and public website are independent Playwright projects with independent commands,
server lifecycles, artifacts, and CI jobs. Running one must not start, import, skip, or mask the
other. Pull requests report both; the release gate requires both.

The Contract Lab has a hard ceiling of 40 collected tests. The count includes skipped, fixme,
focused, repeated-project, and parametrically expanded cases. CI lists the Lab tests and fails
before execution when the count exceeds 40 or when a forbidden annotation is collected. Do not
raise the ceiling. Combine related assertions into a preset journey or move deterministic coverage
down a layer.

One test should normally load one preset and exercise one cohesive contract journey. Loops may
check a small in-journey matrix without generating separate Playwright tests. The suite must cover
all six presets, all four tested recipes, desktop and mobile boundaries, pointer and keyboard
parity, close/reopen and focus restoration, compound input/display/reset/repair/import/export, and
the absence of unexpected console errors or Picodash diagnostics.

Website tests never load Lab presets or access the Lab driver. Lab tests never assert website copy,
navigation, or redirects.

## Verification order

Verify narrowly first and widen only after the owning layer passes:

1. Run the single changed Nexus or Panel test file, or the single Playwright project/file/title.
2. Run the owning package test command or affected browser suite.
3. Run `vp check` for cross-package type and formatting contracts.
4. Run affected builds when exports, bundling, routes, or fixtures changed.
5. Run both browser suites only when their shared infrastructure changed.
6. Run `bun run ready` for the release gate or when the task explicitly requires the full gate.

Build `@picodash/nexus` and `@picodash/picodash` before browser discovery when their built entrypoints
are required. Use allocated Picodash ports and the suite-specific environment variables. A single
unrelated browser failure may be rerun once to establish whether it is reproducible, but it may not
be hidden, quarantined, or used to justify unrelated product changes.
