---
name: picodash
description: Work with Picodash contracts, prototypes, and package boundaries without confusing aspirational APIs with shipped behavior.
---

# Picodash workspace skill

Use this skill for repository work involving Nexus, DashPanel, DashList, Picodash integration,
themes, the evaluation website, or the Contract Lab.

## Current operating state

The initial aspirational contracts and release gates are accepted. Create the documentation baseline
commit before changing product code, then follow the Nexus-first roadmap. Do not silently change an
accepted contract to preserve a prototype shortcut.

## Route the question

- Product purpose: `docs/product/value-propositions.md`
- Roadmap: `docs/ROADMAP.md`
- Nexus architecture: `docs/adr/0002-provider-level-nexus-and-scoped-views.md`
- Nexus decisions: `docs/reference/nexus-contract-decisions.md`
- Nexus API: `docs/reference/nexus.md`
- Shared UI API: `docs/reference/ui.md`
- DashPanel API: `docs/reference/dashpanel.md`
- DashList API: `docs/reference/dashlist.md`
- Picodash integration: `docs/reference/picodash.md`
- Component catalogs: `docs/reference/catalog.md`
- Status conventions: `docs/reference/document-status.md`
- QA ownership and release gates: `docs/reference/contract-conformance.md`
- Test policy: `TESTING.md`
- Workspace rules and glossary: `AGENTS.md`

Accepted decisions and accepted reference sections outrank current source, tests, package READMEs,
`PRODUCT.md`, `CONTEXT.md`, and historical planning documents.

## Product boundaries

- Nexus is the framework-independent value, transaction, scope, persistence, document, adapter, and
  diagnostics product.
- DashPanel is the standalone `DashPanelProvider` and `DashPanel` product. It owns configurable
  dock-position policy, runtime occupancy/allocation, and Nexus-backed settled layout.
- DashPanel uses one preferred-width input: the inherited `--picodash-panel-width` token and a
  higher-precedence per-Panel `width` prop. Reserve direct style width/inline-size. Intrinsic CSS
  widths are valid and boundary-capped; resolved width is never persisted.
- DashList is the standalone `DashList`, `DashGroup`, Dashlet, binding, and reorder product. Every
  Dashlet and DashGroup has an explicit stable node ID independent of its field bindings.
- DashList and DashGroup children are one-to-one List node declarations. DashList permits Dashlets
  and one level of DashGroups; DashGroups contain Dashlets only at initial launch. Arrays and
  fragments may flatten declarations; arbitrary wrappers and nested nodes inside a Dashlet are
  invalid.
- The public Dashlet shell is the only initial registration path. Optional Dashlet anatomy composes
  content inside that shell and never registers nodes or bindings itself.
- Reorderability belongs to ordering containers: DashList controls its immediate Dashlets and
  DashGroups, while DashGroup controls its immediate Dashlets. Dashlet has no `reorderable` prop or
  fixed-barrier behavior. DashList defaults to reorderable; DashGroup inherits that policy unless it
  explicitly overrides its own child container.
- Dashlet and DashGroup nodes may declare `pin="start"` or `pin="end"`; omission selects the
  automatic band. Pin bands are the only lane subdivision, never accept cross-band reorder, and are
  not persisted as user metadata.
- Pointer and keyboard reorder previews are ephemeral and share the same container/band outcomes.
  Commit one changed order at completion; cancellation and no-op sessions write nothing.
- Collapse belongs to DashGroup only at initial launch. Collapsed Dashlets stay mounted, registered,
  and bound while their content is inert and excluded from the accessibility tree.
- Disabled and read-only policies cascade from DashList and DashGroup to Dashlet content. They never
  disable reorder/disclosure behavior or restrict external Nexus writes; read-only also leaves
  unbound actions available.
- A safe-area Dashlet click focuses an explicitly registered primary target, or the named
  `tabIndex={-1}` shell when none is usable. Compound Dashlets nominate their target; never infer it
  by scanning the DOM.
- Dashlet labels, descriptions, and field issues relate to actual controls rather than relying on
  root-shell ARIA. Dirty draft discard is distinct from canonical reset; generic shell
  `status`/`states` props remain Draft.
- Compound Dashlets attribute Nexus-normalized issues by binding alias, then a uniquely bound
  field, then canonical field path. Ambiguous and cross-field issues belong to the named Dashlet
  composition; message parsing is not an attribution mechanism.
- DashList owns generic ready-made Dashlets and their descriptive catalog entries. DashPanel owns no
  Dashlets; Picodash reexports stable DashList components and aggregates package catalogs without
  redefining them. Initial Picodash owns no ready-made Dashlet or additional family. A future
  Picodash component must necessarily coordinate Panel and List behavior; dependency-heavy optional
  families use separate packages and focused contracts. Catalog metadata is not a runtime registry
  or authority mechanism.
- Catalogs are deeply frozen JSON-compatible metadata for Accepted owner components. Picodash
  combines exact owner entries and records facade imports as reexports. Keep React values, loaders,
  callbacks, prop schemas, token inventories, query APIs, and experimental anatomy out.
- DashList owns and exports List behavior actions. `Expand all` and `Collapse all` affect active
  collapsible groups in the current List scope through one metadata commit. Picodash composes the
  same exports; DashPanel reexports generic UI menu composition but owns no List behavior.
- The accepted action surface is `useDashListActions(scopeId?)`, `DashListActionItems`, named
  expand/collapse items, and named Reset submenu/items. Omitted targeting uses nearest Nexus scope;
  explicit targeting stays within the same root. Map `unavailable | disabled | enabled`
  consistently. Built-in reset items invalidate and repeat confirmation if their displayed effect
  changes.
- Action execution returns `not_executed` with unavailable/disabled state or `executed` with
  `CoreTransactionResult | PersistentTransactionResult`. Nexus rejection remains inside the
  executed result; contract misuse still throws.
- Standalone document actions are `useDashListDocumentActions(scopeId?)`,
  `DashListDocumentItems`, `DashListExportItem`, and `DashListImportItem`. They use Nexus plans for
  one current-scope JSON document with no descendants. DashList owns browser I/O and review UX;
  Nexus owns policy/validation/atomicity. Initial Picodash reuses the primary-List workflow and does
  not infer additional-List aggregation. Keep field/scope maps and missing-scope creation out of the
  initial UI.
- DashList's `Reset values…` resets current-List registered values and targeted drafts only.
  `Reset list…` removes current-scope root/group order and collapse overrides only. It exposes no
  combined `Reset all`; initial Picodash adds no implicit descendant or combined reset.
- The initial DashList root exports `TextDashlet`, `NumberDashlet`, `SliderDashlet`, `SwitchDashlet`,
  `SelectDashlet`, `SegmentedDashlet`, and `DisplayDashlet`. Keep anatomy, unbound UI, and catalog
  metadata under `/dashlet`, `/ui`, and `/catalog`; deferred prototype families are not launch
  promises.
- DashList `/ui` exports exactly `TextField`, `NumberField`, `Slider`, `Switch`, `Select`,
  `SegmentedControl`, and `Display` plus their owning types. Do not add Picodash `/advanced` or
  `/dashlet`, DashPanel `/advanced` or `/ui`, or an initial UI catalog. Mark Draft anatomy
  `@experimental` and keep it out of roots and catalogs.
- Ready-made Dashlets require `id`, `field`, and visible `label`; defaults and domain validation stay
  in Nexus. Do not restore per-Dashlet defaults, generic value callbacks, parser/validator props, or
  `ReactiveProp` Nexus selectors. Presentation incompatibility reports without canonical writes;
  `/ui` controls remain unbound and Picodash reexports the exact DashList types.
- Invalid ready-made props are developer contract errors. A valid canonical value that valid props
  cannot represent creates an ephemeral `presentation_incompatible` warning: show the real value,
  never fabricate or clamp control state, and require an explicit replacement transaction. It is
  not persisted, exported, marked `aria-invalid`, or stored as a binding input issue.
- Initial ready-made-specific props are limited to text multiline/rows/placeholder, numeric
  bounds/step/formatting, explicit Slider marks, unique string-or-number choice options, and Display
  formatting. Choice controls do not select fallbacks; ready-made Dashlets accept no children or
  arbitrary inner-control prop bags.
- DashList uses container-responsive shared handle/label/control/trailing tracks across each
  ordering container's pin bands. Groups establish new alignment contexts, inline rows stack below
  the initial threshold, compound rows default to block, and drag previews retain captured grid
  geometry.
- DashList rail presentation uses vertical or horizontal icon strips. Built-ins supply type icons;
  per-Dashlet rail labels are omitted, inherited, or replaced with a shorter string. Groups retain
  disclosure and containment. An active scoped Nexus orientation wins over the List prop so
  Picodash can force main side docks vertical and main top/bottom docks horizontal without coupling
  the two standalone packages. Corner, free, and snapped Panels publish no Picodash orientation
  override.
- A corner rail's effective Nexus or prop orientation selects its effective physical edge. Picodash
  alone coordinates rail spans: same-axis corner pairs receive halves, perpendicular corner rails
  bound one another at their inner edges, and two corners plus a main rail receive thirds. These are
  transient maxima, not durable DashPanel or DashList metadata.
- Rail long press enters transient reorder mode and reveals eligible handles. Icon activation is
  suppressed in the mode, but group disclosure remains available and non-reorderable group children
  appear without handles. Keep an accessible Reorder entry, Done, Escape, and outside dismissal.
- `@picodash/ui` owns theme and density contracts, semantic tokens, shared structural CSS, and
  generic accessible primitives used unchanged by DashPanel and DashList. Its independent theme
  and overlay Providers resolve theme/density attributes and portal/layer defaults. Product
  Providers compose both without making UI depend on Nexus. Density is `regular | compact`,
  orthogonal to light/dark/system/custom color themes. Provider, Panel, and List boundaries inherit
  or override it and detached roots repeat both attributes. Compact changes geometry, retains
  coarse hit targets, and is not persisted automatically.
- Compact is not a theme. UI alone owns light/dark and regular/compact recipes.
  `@picodash/picodash/style.css` aggregates each owning stylesheet once and defines no facade theme.
  Named custom themes provide all 24 shared color tokens plus `color-scheme` in host CSS loaded
  afterward; there is no theme registry, palette merge API, or export for website-only recipes.
- Drawer and sheet are accepted host-selected transient modal DashPanel presentations, not ordinary
  docks. Preserve desktop placement, allow one visible sibling modal per Provider, require visible
  Close, and implement the documented focus, backdrop, scroll, dismissal, portal, and width rules.
- Picodash integrates stable Nexus, DashPanel, and DashList products plus their shared UI
  foundation.
- DashPanel and DashList depend on Nexus and UI, not on one another. Nexus has no UI dependency.
- `@picodash/dashlist/ui` remains DashList-owned. Shared UI admits only product-neutral components
  with identical cross-product accessibility, theme, and interaction contracts and no product
  state or commands.
- AlertDialog/modal confirmation primitives are target-owned by and canonically imported from
  `@picodash/ui`; `@picodash/picodash/ui` may reexport them. Current product-local copies are
  prototype evidence.
- Nexus never imports either UI product; it owns their validated persisted record shapes and exposes
  translation through `@picodash/nexus/integration`.

## Nexus rules

- Root values are canonical; scoped Nexuses are immutable organizational views, not child value
  stores or access-control boundaries.
- `scopeId` is opaque and root-global. Parent-child relationships come only from active declarative
  boundaries.
- Snapshots contain immutable data; commands live on the stable Nexus API.
- Binding input uses `parse → schema → validate`; every other value source uses
  `schema → validate` and never invokes a UI parser.
- Values, drafts, documents, and persisted payloads are JSON-compatible.
- All validation, adapters, migrations, and core persistence are synchronous.
- Expected data rejection returns structured issues. Ownership, lifecycle, and reentrancy misuse
  throws a structured contract error.
- Opaque plans are root-owned and single-use; changed captured state returns `stale_plan` without
  mutation.
- External-owned mode persists Picodash metadata only. Nexus-owned mode persists permitted values
  plus Picodash metadata.
- Imperative Panel deregistration is not a target API.
- Dock occupancy and allocation are Provider runtime. Nexus persists only canonical settled Panel
  placement and its preferred boundary-relative free position.

## QA

Use one primary owner per contract and the cheapest faithful test layer. Keep deterministic state,
geometry, ordering, serialization, and type matrices below the browser. Contract Lab E2E is for
real pointer, layout, focus, portal, browser-storage, media-query, and cohesive integration seams.

Run focused checks first:

```bash
bun run --filter @picodash/nexus check
bun run --filter @picodash/nexus test
bun run --filter @picodash/dashpanel check
bun run --filter @picodash/dashlist check
bun run --filter @picodash/picodash check
```

Use `bun run ready` only for the full gate or when explicitly requested. Reserve worktree ports with
`bun run port:reserve` before starting local servers.
