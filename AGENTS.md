# Picodash agent guide

This file routes agents to current product contracts and records only workspace-wide operating
rules. It is not a duplicate API reference.

## Implementation readiness

The initial aspirational contracts, value propositions, package boundaries, and conformance owners
are accepted. Create one intentional documentation baseline commit before changing product code,
then begin with Store Phase 1 in the contract-led roadmap.

Store, shared UI, DashPanel, DashList, and Picodash implementation follows the accepted roadmap
sequence. Do not skip ahead through private cross-package APIs. Exact compact recipe values,
shared-token consumption tables, measured browser geometry, and linked test evidence are produced
while implementing their owning contracts; they are not unresolved launch API decisions.

Current code remains prototype evidence, not an implicit compatibility requirement.

## Start here

Read the smallest document that owns the question:

| Question                                      | Authoritative document                                                                                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| What does each product offer?                 | [Product value propositions](docs/product/value-propositions.md)                                                           |
| What is the product sequence?                 | [Contract-led roadmap](docs/ROADMAP.md)                                                                                    |
| Why does Store use root and scoped views?     | [ADR 0002](docs/adr/0002-provider-level-store-and-scoped-views.md)                                                         |
| Why does shared presentation live in UI?      | [ADR 0003](docs/adr/0003-shared-ui-foundation.md)                                                                          |
| What exact Store decision was accepted?       | [Store contract decisions](docs/reference/store-contract-decisions.md)                                                     |
| What is the target Store API?                 | [Store target reference](docs/reference/store.md)                                                                          |
| What belongs in the shared UI foundation?     | [Shared UI target reference](docs/reference/ui.md)                                                                         |
| What is the target DashPanel API?             | [DashPanel target reference](docs/reference/dashpanel.md)                                                                  |
| What is the target DashList API?              | [DashList target reference](docs/reference/dashlist.md)                                                                    |
| What does integrated Picodash own?            | [Picodash target reference](docs/reference/picodash.md)                                                                    |
| What metadata helps agents find components?   | [Component catalog target reference](docs/reference/catalog.md)                                                            |
| Is a documented feature shipped and verified? | [Documentation status](docs/reference/document-status.md) and [conformance matrix](docs/reference/contract-conformance.md) |
| Where should a behavior be tested?            | [Testing policy](TESTING.md) and [conformance matrix](docs/reference/contract-conformance.md)                              |
| What does the prototype package export now?   | The package README and current source, explicitly treated as prototype evidence                                            |

When documents conflict, use this precedence:

1. Accepted ADRs and accepted decisions.
2. Accepted sections of target references.
3. The roadmap and documentation-status rules.
4. Current code, tests, and package READMEs as prototype evidence.
5. Historical documents, including superseded ADR 0001 and unreconciled `PRODUCT.md`/`CONTEXT.md`.

Do not silently revise an accepted contract to match an implementation shortcut. Record a genuine
constraint and revise the decision explicitly.

## Product model and value

### Store

`@picodash/store` is a typed state foundation for configurable React interfaces. It provides one
synchronous, validated value authority plus scoped Panel/List metadata. It may own values and
persistence or adapt an existing application store.

Store is independently useful and is the first product in the roadmap.

### DashPanel

`@picodash/dashpanel` is a standalone React panel shell for movable, dockable, dismissible arbitrary
content. It supplies Provider hosting, configurable dock positions, collision-safe dock allocation,
boundaries, portals, accessible actions, transient visibility/activation, and Store-backed durable
layout overrides without requiring DashList.

### DashList

`@picodash/dashlist` is a standalone React composition system for ordered, groupable controls,
readouts, visualizations, previews, and actions. It supplies typed bindings, drafts, accessible
reordering, and durable order/collapse overrides without requiring DashPanel.

### Picodash

`@picodash/picodash` integrates Store, DashPanel, DashList, themes, and ready-made Dashlets. It is a
facade and control-interface product, not an application framework or monolithic Dashboard
component.

### Shared UI foundation

`@picodash/ui` supplies theme and density contracts, product-neutral theme and overlay Providers,
semantic tokens, shared structural CSS, and generic accessible primitives used unchanged by
DashPanel and DashList. It supports the products; it is not a fourth independently marketed product
or a home for product behavior.

Applications continue to own routing, data transport, authentication, authorization, exposure
policy, and declarative JSX composition.

## Roadmap boundaries

1. Complete Store contracts and reach a useful Store alpha.
2. Establish the shared UI foundation needed by both UI products.
3. Dogfood Store and UI independently through DashPanel and DashList.
4. Feed consumer findings back into their owning foundations before stability.
5. Stabilize DashPanel and DashList against their own release gates.
6. Build Picodash integration after the three products are stable.

A vertical slice stays within the product currently being developed. Higher products may expose a
foundation gap, but they do not solve it through private bypasses.

A small cross-package smoke harness may detect public-contract incompatibility. It must not become
premature Picodash implementation or duplicate lower-layer tests.

## Glossary

- **Picodash:** the integrated product and `@picodash/picodash` facade. Preserve lowercase `d`.
- **Store:** the framework-independent typed state product in `@picodash/store`.
- **Root Store:** one value authority, field set, persistence identity, and durable scope registry.
- **Scoped Store:** an immutable view of a root Store attributed to one `scopeId`; it still exposes
  every root field and value.
- **Scope:** a root-global organizational identity for durable metadata, registration, management,
  and operation attribution. It is not a value copy, string hierarchy, or authorization boundary.
- **Provider:** a hard Store/scope-ancestry and Panel-host boundary. `DashPanelProvider` is the
  standalone target; `PicodashProvider` is the integrated facade Provider and current prototype.
- **Provider ID:** runtime host identity within one root Store. It does not namespace scopes.
- **DashPanel:** the standalone panel product and target component name. `PicodashPanel` is the
  current prototype name, not a second standalone component contract.
- **Dock position:** one named flush Panel placement target such as `top-left` or `full-right`.
- **Dock arena:** Panels sharing Provider, resolved boundary identity, and resolved inset.
- **Dock slot:** the collision identity claimed by a docked Panel; full and center targets on the
  same main edge share a slot.
- **Dock occupancy:** the transient committed lifecycle lease between a Panel and a dock slot.
- **Dock allocation:** the transient size cap assigned to docked occupants sharing an edge; it is
  recomputed from current occupancy and never persisted.
- **DashList:** the standalone List/Dashlet composition product and target root component.
  `PicodashList` is the current prototype name, not a second standalone contract.
- **DashGroup:** a declarative DashList container with its own stable node ID and optional collapse
  override. A group is not a Store scope. The initial contract permits one group level, so a
  DashGroup contains Dashlets but not another DashGroup.
- **Dashlet:** one composable control, readout, visualization, preview, action, or compound item
  inside a DashList. It is the public registered leaf shell, with an explicit stable ID independent
  of its field bindings.
- **Dashlet anatomy:** non-registering semantic primitives from `@picodash/dashlist/dashlet` used to
  compose content inside a Dashlet.
- **List behavior action:** a headless DashList-owned operation targeting one active List scope.
  Generic UI may present it, but DashPanel and Picodash do not acquire its behavior ownership.
- **Shared UI foundation:** `@picodash/ui`; the theme, density, token, structural CSS, and generic
  accessible primitive layer consumed by both UI products. It owns no product state or commands.
- **DashHeader:** a presentational shared UI component whose named slots receive caller-owned
  header content. DashPanel and DashList retain the behavior attached to that content.
- **Rail presentation:** a vertical or horizontal DashList presentation that represents Dashlets as
  named icons and reveals one Dashlet or directly operates an eligible toggle. Groups preserve their
  disclosure and child-containment behavior.
- **Effective rail edge:** the physical container edge followed by a rail. Main-edge docks determine
  it directly; at a corner, the effective Store or prop orientation selects one of the two adjoining
  edges.
- **Rail allocation:** Picodash-only transient arena coordination that caps integrated rail spans
  from occupancy, effective edges, and resolved cross-axis thickness. It is not DashPanel or
  DashList persistence.
- **Rail reorder mode:** transient List interaction entered by long press or an accessible Reorder
  action. It reveals every eligible visible handle without changing durable order until a drag
  commits.
- **List node declaration:** one direct child that declares exactly one node and exposes the same
  explicit node ID. DashList permits Dashlet and DashGroup declarations; DashGroup permits Dashlet
  declarations only at initial launch. Arrays and fragments are transparent; arbitrary wrappers
  are not declarations.
- **Reorderable container:** a DashList or DashGroup whose `reorderable` policy applies uniformly to
  its immediate nodes. Dashlets do not own reorderability, and node-level fixed barriers do not
  create additional order lanes. DashList defaults to reorderable; an omitted group policy inherits
  the List policy, while an explicit group value affects only its Dashlet children.
- **Pin band:** one declarative `start`, automatic, or `end` ordering lane within a DashList or
  DashGroup container. Pin classification comes from JSX and is not durable user state; nodes never
  reorder across bands.
- **Collapse override:** a durable DashGroup user preference relative to its current declared
  default. Collapsed descendants remain mounted and registered; collapse changes presentation and
  interaction availability, not containment or lifecycle.
- **Disabled policy:** a cascading DashList/DashGroup/Dashlet policy that prevents Dashlet content
  controls and actions without disabling reorder or disclosure behavior.
- **Read-only policy:** a cascading DashList/DashGroup/Dashlet policy that prevents input bindings
  from changing canonical values without disabling unbound actions or external Store writes.
- **Primary focus target:** the control explicitly selected to receive a Dashlet safe-area click.
  Single-control built-ins register it automatically; compound Dashlets nominate it, and the shell
  is the fallback without entering sequential keyboard navigation.
- **Dashboard:** an application composition of Panels and Dashlets, not a required Picodash
  component abstraction.
- **Field:** one immutable root-owned typed value contract.
- **Field handle:** the nominal root-owned object used to bind a component to a field.
- **Binding:** one presentation/editor of a field, identified by scope, item, and alias. Drafts and
  input issues belong to bindings.
- **Issue attribution:** DashList's deterministic mapping of a Store-normalized issue to one
  binding or to its containing Dashlet composition. It uses structured identity and canonical
  paths, never message parsing.
- **Adaptive Panel presentation:** a transient modal drawer or sheet projection that preserves the
  Panel's ordinary durable placement preference. It is host-selected, not an automatic breakpoint.
- **Catalog entry:** descriptive package-owned metadata for one public component. It supports
  documentation and discovery but does not register components or grant runtime authority.
- **Presentation mismatch:** derived Dashlet state where a valid canonical value cannot be
  represented by the current valid control configuration. It is not a Store validation issue and
  never writes or masks the value.
- **Density:** the orthogonal `regular | compact` presentation scale owned by `@picodash/ui`.
  Density changes geometry tokens, not color-theme identity, semantics, or durable state.
- **Binding handle:** an opaque root- and registration-generation-owned handle used by interaction
  commands; it is not reconstructed from strings.
- **Canonical value:** the complete validated root value observed by every scope.
- **Baseline:** field defaults merged with validated initial values before persistence overlays.
- **Durable metadata:** Panel layout and DashList order/collapse overrides that may be persisted.
- **Interaction state:** ephemeral draft, touched, input issue, focus, hover, active, and conflict
  state. It is never persisted.
- **Host runtime:** Provider-local portals, boundaries, visibility, activation, and z-order.
- **Adapter:** the synchronous whole-record bridge to an externally owned application value store.
- **Document:** a versioned export/import projection with explicit Store/scope identity and field
  disclosure policy.
- **Plan:** an opaque, root-owned, single-use description of a repair, overwrite, prune, persistence,
  export, or import operation; stale plans fail without mutation.
- **Contract status:** whether a behavior is Draft, Accepted, or Revised.
- **Implementation status:** whether behavior is Prototype, Planned, Partial, Implemented, or
  Verified.

## Package boundaries

- `@picodash/store` owns framework-independent values, scopes, transactions, adapters, persistence,
  documents, durable metadata, and diagnostics.
- `@picodash/store/react` owns public Store hooks and typed selectors.
- `@picodash/store/integration` owns the supported advanced context and declarative lifecycle-lease
  protocol used by the separate UI packages.
- `@picodash/ui` owns shared theme and density contracts, semantic tokens, shared structural CSS,
  product-neutral theme and overlay Providers, and generic accessible primitives that satisfy its
  admission rules. It owns no Store, Panel, List, Dashlet, placement, ordering, or persistence
  behavior.
- `@picodash/dashpanel` owns Panel/Provider composition and placement exports. It owns no Dashlets.
- `@picodash/dashlist` owns List, group, Dashlet anatomy, binding composition, ordering, collapse
  presentation, generic ready-made Dashlets, their catalog metadata, and List behavior actions.
- `@picodash/picodash` integrates and reexports stable foundational contracts and aggregates their
  package-owned catalogs without copying entries.

The accepted initial publication surfaces are exactly:

```text
@picodash/store
@picodash/store/react
@picodash/store/integration
@picodash/ui
@picodash/ui/style.css
@picodash/dashpanel
@picodash/dashpanel/integration
@picodash/dashpanel/catalog
@picodash/dashpanel/style.css
@picodash/dashlist
@picodash/dashlist/dashlet
@picodash/dashlist/ui
@picodash/dashlist/catalog
@picodash/dashlist/style.css
@picodash/picodash
@picodash/picodash/ui
@picodash/picodash/catalog
@picodash/picodash/style.css
```

Do not add Picodash `/advanced` or `/dashlet`, DashPanel `/advanced` or `/ui`, or an initial UI
catalog. DashList `/ui` contains exactly `TextField`, `NumberField`, `Slider`, `Switch`, `Select`,
`SegmentedControl`, and `Display` plus their owning types. Experimental anatomy stays under
DashList `/dashlet`, is marked `@experimental`, and is excluded from catalogs and stable promises.

Every product catalog is deeply frozen, JSON-compatible descriptive data conforming to the
[catalog reference](docs/reference/catalog.md). Owner entries are not copied during facade
aggregation. Do not add React values, loaders, callbacks, prop schemas, token inventories,
component registration, or a catalog query API.

The four canonical executable examples are Store-owned persistence, standalone DashPanel,
standalone DashList, and same-scope integrated Picodash. Focused recipes cover the manual external
adapter, a complete named theme at both densities, a canvas editor with an explicit child rail, and
host-selected drawer/sheet presentation. Keep their React 19 composition framework-neutral; limit
Next.js guidance to the client boundary and global stylesheet import until another host receives a
separately maintained contract.

Shared UI public props are named Picodash-owned types. Extend an identified public React Aria
interface only deliberately, omit every Picodash-reserved semantic or structural prop, and never
publish `ComponentProps<typeof InternalComponent>` or internal variant-helper types. DashPanel and
DashList explicitly reexport only `DashHeader` and the shared ActionMenu family from
`@picodash/ui`; generic Button, AlertDialog, Tooltip, and Provider imports remain UI-owned.

`PicodashProvider` is the only initially facade-owned React component. The Picodash root reexports
the exact canonical `DashPanel`, `DashList`, `DashGroup`, `Dashlet`, and foundation-owned types; do
not restore `PicodashPanel`, `PicodashList`, `PicodashGroup`, `PicodashItem`, `Dashlist`, or
`DashletGroup` aliases. Integrated behavior uses narrow foundation-owned integration entries rather
than facade wrappers or private imports.

`PicodashProviderProps` inherits `DashPanelProviderProps` and narrows `dockPositions` to corners and
left/right side positions. It accepts a root Store, defaults `providerId` to `default`, and exposes
no persistence, storage-key, integration-adapter, rail-allocation, or integrated-action props. A
direct child DashList still needs `id`; only a scoped Panel context permits an id-less primary List.
Release Picodash integration leases before the composed DashPanel Provider host lease.

DashPanel uses one preferred-width input. `--picodash-panel-width` supplies an inherited or
selector default; the `width` prop overrides it for one Panel. Reserve direct `style.width` and
`style.inlineSize`. Intrinsic CSS values such as `fit-content` are valid and boundary-capped, but a
resolved content width is never persisted. Full top/bottom docks and top/bottom sheets own their
inline span; other placements restore the same preferred width when they become active again.

DashPanel drawer and sheet presentations are host-selected transient modal projections. They keep
desktop layout durable and dormant, require visible Close, backdrop, focus containment, scroll
locking, Escape/outside dismissal, and focus restoration, and permit only one visible sibling modal
per Provider. Movement and layout actions are unavailable while projected. Do not introduce an
automatic product breakpoint or gesture behavior without revising the owning contract.

Close hides a Panel. `onRequestRemove` only requests application-owned unmounting after confirmed
`Remove panel…`. Use `DashPanelTrigger`, explicit `DashPanelLauncher` items, and `useDashPanel` for
high-level runtime control; do not add an automatic launcher registry, mutable Provider store,
generic Panel selector, or Motion-specific public props.

Default integrated Panel-menu composition uses `DashPanelIntegrationProvider` from
`@picodash/dashpanel/integration`, with one nearest `defaultActionItems` component receiving only
the resolved Panel `scopeId`. Picodash contributes the same-scope `DashListActionItems` before
Panel-owned placement/reset items. `actionMenu={false}` hides everything; any custom item array
replaces contributions and defaults, and an empty array renders no trigger. Do not turn this seam
into a registry, application plugin API, private controller channel, or persistence path.

The same-scope List is the Panel's primary DashList. Additional DashLists in one Panel are permitted
advanced composition, require explicit child-scope IDs, and never alter or aggregate into the
primary default action target. Applications target them through their own List chrome or explicit
`DashListActionItems scopeId`. Do not add an inferred all-Lists submenu or duplicate conflict merely
because several distinct List scopes share Panel content.

The initial ready-made DashList inventory is `TextDashlet`, `NumberDashlet`, `SliderDashlet`,
`SwitchDashlet`, `SelectDashlet`, `SegmentedDashlet`, and `DisplayDashlet`. Export them from the
DashList root; keep anatomy under `/dashlet`, unbound controls under `/ui`, and descriptive metadata
under `/catalog`. Picodash reexports the same root components and aggregates catalogs; it owns no
ready-made Dashlet or extra component family at initial launch.

A future component belongs to Picodash only when it necessarily coordinates DashPanel and DashList
behavior. Keep field-bound or List-only components in DashList and product-neutral primitives in UI.
A dependency-heavy optional family requires its own package and focused contract; never add its
runtime dependency, placeholder exports, or registry to the core facade speculatively.

Ready-made Dashlets require explicit `id`, typed `field`, and visible `label`. Field defaults and
validation belong to Store: do not add per-Dashlet `defaultValue`, generic value callbacks, or
parser/validator overrides. Configuration props are ordinary React values, not hidden Store
selector callbacks. Incompatible presentation changes report without silently writing canonical
values. `/ui` controls remain unbound; Picodash reexports exact DashList types without wrappers.

The stable registered-node names are `DashGroup`, `DashGroupProps`, `Dashlet`, `DashletProps`, and
`CompoundDashletProps`. Keep their configuration as ordinary React values; do not restore prototype
`ReactiveProp`, `visible`, generic `states`/`status`, `contentClassName`, `valueMode`,
`onValueChange`, or field-derived node IDs. Dashlet binding render contexts use common shell data
plus `binding` or `bindings`; do not expose the prototype's duplicated `fieldState`/string-error
surface.

Treat invalid ready-made configuration as a structured developer contract error. Treat a valid but
unrepresentable canonical value as an ephemeral `presentation_incompatible` warning: show the real
value, never fabricate or clamp control state, allow only explicit replacement, and do not persist,
export, or record it as a Store input issue. Presentation warnings use descriptions rather than
`aria-invalid` and omit field values from diagnostics.

Keep initial ready-made props narrow: Text supports multiline/minimum rows/placeholder; Number and
Slider support finite bounds, step, and number formatting; Slider also accepts explicit marks and a
value formatter; Switch has no specific launch props; Select and Segmented accept unique string or
number choices; Display accepts a value formatter. Choice controls never select the first option
implicitly. Do not add `children` or arbitrary inner-control prop bags to ready-made Dashlets.

DashList exports List behavior actions for standalone and Picodash composition. `Expand all` and
`Collapse all` target active collapsible groups in one List scope and commit once. Picodash composes
these exports into integrated menus; DashPanel reexports generic UI menu composition and owns Panel
behavior, not List actions.

The accepted action surface is `useDashListActions(scopeId?)`, `DashListActionItems`, named
expand/collapse items, and the named Reset submenu/items. Omitted targeting uses the nearest Store
scope; explicit targeting selects an active DashList elsewhere in the same root without creating an
entity boundary. There is no action-level `store` prop. Headless actions expose
`unavailable | disabled | enabled`; built-in reset items add dangerous-operation confirmation and
invalidate it whenever the displayed effect changes.

Action execution returns either `not_executed` with current unavailable/disabled state, or
`executed` with the Store's `CoreTransactionResult | PersistentTransactionResult`. An executed
transaction may still be a structured rejection. Contract errors continue to throw and must not be
normalized into action results.

Standalone document actions are `useDashListDocumentActions(scopeId?)`,
`DashListDocumentItems`, `DashListExportItem`, and `DashListImportItem`. They handle one current
scope, use JSON only, exclude descendants, and appear in `DashListActionItems` when Store
capabilities permit. Store owns plans, validation, policy, and atomic execution; DashList owns
preview/confirmation, clipboard, file, download, and announcement UX. Do not expose field/scope
mapping or missing-scope creation in the initial UI. Initial Picodash reuses the primary-List
workflow without implicitly aggregating additional Lists; any future multi-target UI requires a
separate Picodash contract.

Keep DashList reset domains explicit. `Reset values…` resets fields registered by the current List
and discards targeted drafts without changing metadata. `Reset list…` removes root/group order and
group-collapse overrides without changing values or drafts. DashList has no `Reset all` action;
initial Picodash adds no implicit descendant or combined reset.

DashPanel and DashList depend on compatible Store and UI foundations, not on one another. Store
never depends on UI or either UI product: it owns validated JSON persistence records for their
built-in metadata, while the UI packages own public behavior and prop types. Shared components are
admitted to UI only when both products use identical product-neutral semantics, accessibility,
theme behavior, and interactions without product state or commands.

`@picodash/dashlist/ui` remains the DashList-owned unbound-control surface. DashPanel, DashList, and
Picodash explicitly reexport only the shared UI contracts they promise; do not use blanket exports
or cross-package source imports. The current `@picodash/theme` package is prototype evidence and is
replaced cleanly during implementation rather than retained as a second authority or alias.

Modal confirmation primitives, including the AlertDialog family, are target-owned and canonically
imported from `@picodash/ui`. `@picodash/picodash/ui` may explicitly reexport them. Current
DashPanel/DashList copies and their `/ui` paths are prototype compatibility surfaces, not shared
ownership.

Keep color theme and density orthogonal. Theme contexts, Provider/Panel/List overrides, and detached
portal roots carry both resolved attributes. Density defaults to `regular`; `compact` changes shared
geometry but preserves coarse-pointer hit targets. UI packages do not persist density automatically.
`PicodashThemeProvider` owns resolved theme/density attributes; the independent
`PicodashOverlayProvider` owns portal and layer defaults. Product Providers compose both without
making UI depend on Store. Detached roots repeat resolved attributes and never mutate their shared
portal container.

`compact` is never a theme. UI alone owns light/dark recipes, system resolution, and the separate
regular/compact density recipes. `@picodash/picodash/style.css` aggregates the owning styles exactly
once and defines no new recipe. A named custom theme supplies all 24 shared color tokens plus CSS
`color-scheme` after package styles; do not add a registry, palette object, merge API, Provider
`themes` prop, compound color/density names, or package exports for website-only themes.

Do not document retired package paths, `apps/demo`, or the legacy imperative Panel deregistration
model as current targets.

## Prototype policy

The current implementation congealed before the new product contracts were explicit. Treat every
existing API and test as a working prototype until it is reconciled with the target reference.

- Prototype behavior may be retained, redesigned, or removed.
- Clean pre-v1 breaks are preferred over aliases unless compatibility is requested explicitly.
- Existing tests do not confer contract status automatically.
- Useful prototype behavior advances only after its owner, target contract, and evidence are clear.
- Package READMEs currently describe shipped prototype APIs and must not override accepted target
  decisions.

## QA strategy

One contract has one primary test owner. Verify it at the cheapest layer that can faithfully observe
the behavior.

- Store pure/type/model tests own data and state invariants.
- DashPanel/DashList component tests own React wiring, semantic DOM, ARIA, and deterministic events.
- Pure product tests own geometry, ordering, reconciliation, and graph algorithms.
- Contract Lab E2E owns only real layout, pointer capture, focus traversal/restoration, portals,
  browser storage, media queries, viewport, zoom, and cohesive browser seams.
- Picodash integration tests prove composition without repeating foundational matrices.
- Website E2E proves public journeys, not internal permutations.

Do not add one test per documented sentence. Use table-driven, property-based, or model-based tests
for large state spaces.

For regressions:

1. Identify the violated contract and primary owner.
2. Expand the existing invariant test at the lowest faithful layer.
3. Add browser evidence only when the failure requires a browser.
4. Merge it into a cohesive existing journey when possible.
5. Remove overlapping or obsolete tests in the same cutover.

The Contract Lab hard ceiling remains 40 collected tests and is not a target. There are no legacy,
quarantine, skip, fixme, retry-only, or hidden browser suites. See [TESTING.md](TESTING.md).

## Repository topology

- `packages/store`: Store prototype and tests.
- `packages/theme`: current theme prototype scheduled to be replaced by target `packages/ui`.
- `packages/dashpanel`: standalone DashPanel prototype.
- `packages/dashlist`: standalone DashList prototype.
- `packages/picodash`: integrated facade prototype.
- `apps/web`: production Next.js evaluation website; `/` is the only public route.
- `apps/lab`: local Contract Lab at `/lab` plus checked-in audit report rendering.
- `docs/adr`: architectural decisions.
- `docs/reference`: aspirational contracts, status, decisions, and conformance.
- `docs/product`: product positioning and value.

Generated `dist/` output is never edited directly.

## Toolchain

The workspace uses Vite+ through the global `vp` CLI. Vite+ wraps Vite, Rolldown, Vitest, tsdown,
Oxlint, Oxfmt, and task execution. Local documentation is in `node_modules/vite-plus/docs`.

Use Bun for workspace scripts and package management.

## Verification commands

Run the narrowest owning check first. Do not run broad suites merely because they exist.

```bash
bun install
vp check
vp run -r test
vp run -r build
```

Focused product commands:

```bash
bun run --filter @picodash/store check
bun run --filter @picodash/store test
bun run --filter @picodash/dashpanel check
bun run --filter @picodash/dashlist check
bun run --filter @picodash/picodash check
```

Browser suites:

```bash
bun run test:e2e:lab:cap
bun run test:e2e:lab
bun run test:e2e:web
```

Release/full gate:

```bash
bun run release:check
bun run ready
```

`bun run ready` runs audit, release, artifact, evaluation, check, test, build, and both E2E gates.
Use it for a release boundary or when explicitly requested, not for every documentation edit.

If setup or Vite+ behavior is wrong, run `vp env doctor` and retain its output.

## Development servers and ports

- `6030`: web development server (`WEBSITE_PORT`).
- `6031`: web production preview (`WEBSITE_PORT`).
- `6032`: Lab development server (`LAB_PORT`).
- `6033`: web E2E server (`WEBSITE_PORT`).
- `6034-6039`: temporary worktree allocations.

Use `bun run port:reserve` in a worktree and `bun run port:release` after its work is merged. Do not
invent ports outside the allocated range.

## Cross-cutting implementation rules

These rules are already accepted or protect current high-risk behavior:

- Keep canonical values and persisted payloads strict JSON data.
- Validate a complete candidate batch before any canonical mutation.
- Keep binding-input parsers, Standard Schema contracts, validators, adapters, and core persistence
  synchronous. UI parsers do not run against defaults, persisted data, adapter snapshots, imports,
  or migration output.
- Keep high-frequency pointer/visual state outside persisted Store snapshots.
- Persist settled overrides, not declared defaults, previews, visibility, focus, activation, or
  z-order.
- Preserve pointer and keyboard outcome parity for reorder and placement.
- Keep rail orientation precedence explicit: an active scoped Store override wins over the DashList
  prop. Picodash forces main left/right docks vertical and main top/bottom docks horizontal; corners,
  free positions, and snaps publish no Picodash override. Do not persist a dock-derived orientation
  without a separately accepted durable preference contract. Publish only through
  `acquireDashListOrientationOverrideLease`; update a live concrete override atomically and release
  it for corner/free/snapped dispositions. Applications use the DashList prop rather than a general
  Store override command.
- Keep integrated rail allocation in Picodash. Two same-axis corner rails share an edge one-half
  each; a perpendicular corner rail bounds the other at its inner edge; both corners plus a main rail
  receive one-third each. Resolve cross-axis thickness before main-axis span and treat every
  allocation as a transient maximum.
- In rail reorder mode, suppress Dashlet icon activation but keep DashGroup disclosures operable.
  Expanded children show handles only when their group container is effectively reorderable.
  Long press is a shortcut, not the sole entry path; retain an accessible Reorder action, visible
  Done control, Escape, and outside-interaction dismissal.
- Keep DashList reorderability container-owned: only DashList and DashGroup expose `reorderable`,
  and the parent container controls movement of its immediate nodes.
- Keep pointer and keyboard reorder candidates ephemeral; commit one changed order on completion,
  write nothing for cancellation or no-op sessions, and use one DashList-owned live region.
- Keep DashList row layout container-responsive. One ordering container shares handle, label,
  control, and trailing tracks across pin bands; groups start new alignment contexts. Inline rows
  stack below the accepted initial threshold, compound Dashlets default to block, and drag previews
  preserve their captured grid geometry.
- Keep collapsed DashGroup descendants mounted and registered. Repair focus before making content
  inert, and never expose collapse on Dashlet in the initial contract.
- Keep disabled/read-only policies additive and separate from authorization and structural
  customization. Do not make an entire Dashlet inert merely because its content is disabled.
- Preserve Dashlet safe-area row focus through explicit primary-target registration. Do not restore
  the prototype's DOM search for selected, checked, or generally focusable descendants. The public
  path is `primaryFocusRef?: RefObject<HTMLElement | null>`; do not expose `useRegisterDashlet` or an
  imperative registration command.
- Attach Dashlet labels, descriptions, and field issues to the actual controls that consume them.
  Root-shell ARIA relationships do not propagate to nested inputs; do not use color alone for
  status.
- Attribute compound Dashlet issues by matching binding alias, then a uniquely bound field, then
  its canonical Store path. Keep ambiguous and cross-field issues on the named Dashlet composition;
  never parse issue messages or mark every child control invalid.
- Keep custom parser/validator callback identities stable across React renders.
- Use semantic `--picodash-*` tokens and public component variants instead of internal classes.
- Preserve provider portal, z-index, theme, and accessible overlay contracts.
- Implement drawer and sheet as the accepted transient modal Panel presentations, not as ordinary
  docks with different CSS. Preserve desktop placement and the documented modality, occupancy,
  focus, dismissal, backdrop, scroll, width, portal, and trigger-restoration behavior.
- Treat invalid/obsolete prototype persistence as current-default recovery; do not invent silent
  compatibility migrations.

Detailed placement and boundary behavior belongs in the DashPanel reference, package README, and
owning geometry tests—not in this guide.

## Documentation maintenance

- Contract changes update the decision ledger and affected target reference.
- Ownership, identity, persistence, or package-boundary changes require an ADR amendment or new ADR.
- Implementation changes update status and conformance evidence in the same change.
- Public command, package-entrypoint, or workspace-topology changes update this guide and relevant
  operational/package README.
- Examples that become normative should be typechecked or exercised as fixtures.
- Do not copy complete API reference material into `AGENTS.md`, `README.md`, `SKILL.md`, or `llms.txt`.
  Link to its owner instead.

## Copy quality

Product copy leads with the concrete product, user, and outcome. Technical architecture follows
only when it explains a user-visible benefit or constraint.

- Prefer specific nouns and outcomes: Panels, Lists, Dashlets, typed values, placement, ordering,
  persistence, and adapters.
- Do not use generic claims such as “powerful,” “seamless,” or “modern.”
- Do not use metaphors such as “surface,” “journey,” or “without the ceremony” in place of behavior.
- Documentation begins with one factual purpose sentence and uses realistic examples.
- Preserve `Picodash`, `DashPanel`, `DashList`, `Dashlet`, and the `@picodash` package scope exactly.
