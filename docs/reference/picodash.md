# Picodash target reference

Picodash is the integrated React control and monitoring product built from Nexus, DashPanel, and
DashList. This page describes the aspirational `@picodash/picodash` facade and integration contract.

## Status

> Contract: Accepted
> Implementation: Partial
> Evidence: The alpha facade publishes only the root and `/ui` entries, delegates Provider
> behavior to the public DashPanel Provider, and has component, type, and package-artifact tests.
> Ready-made Dashlets, catalogs, integrated menus, rail coordination, and executable examples remain
> planned work.
> Notes: This page separates the Partial alpha publication subset from the accepted final contract.

## Product purpose

Picodash gives an existing React application one integrated way to render Panels containing
ordered, grouped Dashlets backed by typed application values. It is a facade and composition system,
not an application framework or monolithic Dashboard component.

Applications continue to own routing, data transport, authentication, authorization, exposure
policy, and the JSX that decides which Panels and Dashlets exist.

## Target composition

```tsx
const nexus = createPicodashNexus({
  nexusId: 'application-controls',
  schemaVersion: 1,
  valueOwner: 'nexus',
  fields: {
    theme: { defaultValue: 'system' },
    density: { defaultValue: 1 },
  },
})

function ApplicationControls() {
  return (
    <PicodashProvider nexus={nexus}>
      <DashPanel id="settings" title="Settings">
        <DashList>
          <SelectDashlet
            id="theme"
            field={nexus.fields.theme}
            label="Theme"
            options={['light', 'dark', 'system']}
          />
          <SliderDashlet id="density" field={nexus.fields.density} label="Density" />
        </DashList>
      </DashPanel>
    </PicodashProvider>
  )
}
```

The id-less primary List inherits `settings`; Panel and List share one scope and may contribute one
entity of each kind.

## Additional child-scoped Lists

The canonical Picodash composition has zero or one same-scope primary DashList in a Panel.
Additional DashLists remain available for advanced compositions such as pairing a canvas tool rail
with a normal property-inspector List. Each additional List requires an explicit ID, occupies its
own root-global scope, and registers an active declarative relationship from the Panel scope. Scope
IDs do not encode ancestry.

Additional Lists do not contribute automatically to Panel chrome, change the primary List's action
target, or become an inferred aggregate. Applications that need their actions place List chrome or
explicitly compose `DashListActionItems` with the additional List's `scopeId`.

> Contract: Accepted through Nexus
> Implementation: Planned

## Canonical names and integration boundary

> Contract: Accepted
> Implementation: Partial

`PicodashProvider` is the only initially facade-owned React component. Components owned by a
foundation retain one canonical public name everywhere:

- `DashPanel`, `DashPanelTrigger`, `DashPanelLauncher`, and `useDashPanel` remain DashPanel-owned;
- `DashList`, `DashGroup`, `Dashlet`, their hooks, and ready-made Dashlets remain DashList-owned; and
- Nexus and shared UI exports retain their owning package names and exact type identities.

`@picodash/picodash` explicitly reexports those components and types without wrapping, cloning, or
renaming them. The prototype aliases `PicodashPanel`, `PicodashList`, `PicodashGroup`,
`PicodashItem`, `Dashlist`, and `DashletGroup` are migration evidence and do not enter the target
API.

The alpha `PicodashProvider` delegates the public `DashPanelProvider` with the same Nexus, theme,
overlay, boundary, and density behavior. It does not create a second canonical Nexus, Panel runtime,
List registry, theme resolver, persistence channel, or transient integration coordinator.

Automatic integrated behavior uses narrow integration contracts owned by the affected foundation.
For example, Picodash contributes DashList actions to default Panel menus through a DashPanel-owned
integration channel rather than a `PicodashPanel` wrapper. If a required seam cannot be expressed
through accepted foundation contracts, the owning foundation contract is revised before Picodash
implements a workaround.

Apart from `PicodashProvider`, initial composition remains explicit JSX. No schema-generated
Dashboard, automatic Panel/List creation, component registry, or facade-only component factory is
accepted.

## Provider contract

> Contract: Accepted
> Implementation: Partial

`PicodashProvider` exposes the DashPanel Provider contract with Picodash's deliberate dock-policy
restriction:

```ts
type PicodashDockPosition = Exclude<
  DashPanelDockPosition,
  'full-top' | 'center-top' | 'full-bottom' | 'center-bottom'
>

type PicodashProviderProps<TValues extends object, CustomTheme extends string = never> = Omit<
  DashPanelProviderProps<TValues, CustomTheme>,
  'dockPositions'
> & {
  dockPositions?: readonly PicodashDockPosition[]
}
```

- `nexus` is a required root Nexus. A scoped Nexus is rejected.
- `providerId` defaults to `default`; the Nexus and resolved Provider ID are immutable for one mount.
- `boundary`, `boundaryInset`, `portalContainer`, `layerBase`, `theme`, and `density` retain their
  DashPanel/shared UI meanings and runtime update behavior.
- `dockPositions` may narrow Picodash's corners and left/right side positions. Its type and runtime
  validation cannot re-enable `full-top`, `center-top`, `full-bottom`, or `center-bottom`. Fixed and
  Hybrid modes continue to apply their own accepted position filters.
- Every other inherited DashPanel Provider default remains unchanged.
- There is no Provider-level persistence, storage-key, integrated-action, rail-allocation, or
  integration-adapter prop. Nexus owns persistence; the other behaviors are built-in Picodash
  coordination rather than application extension points.

The Provider supplies the unscoped root Nexus context. A `DashList` rendered directly within it
therefore requires an explicit `id`; an id-less primary List resolves the scoped context supplied by
its nearest `DashPanel`. `providerId` is host identity and never becomes a Nexus scope ID.

The alpha implementation validates the eight permitted corner and left/right dock positions and
rejects malformed values or the four top/bottom full/center positions before delegation. It does
not yet acquire integrated action, rail, or other Picodash coordination leases.

A nested Provider is a hard Nexus-ancestry and relationship boundary. Providers sharing one root
must use distinct IDs, so two omitted IDs conflict as duplicate `default` hosts. A nested Provider
using a different root starts an independent domain while inheriting ordinary theme and overlay
defaults unless it overrides them.

On teardown, Picodash releases its orientation, rail-allocation, action-contribution, and other
integration leases before the composed DashPanel Provider releases its Nexus host lease. No
transient coordinator state is persisted, exported, or retained after teardown.

## Integration ownership

| Concern                                         | Owner                              |
| ----------------------------------------------- | ---------------------------------- |
| Canonical fields, values, transactions          | Nexus                              |
| Durable scope metadata and relationships        | Nexus                              |
| Panel hosting, placement, portals, visibility   | DashPanel                          |
| Items, groups, bindings, order, collapse        | DashList                           |
| Theme, density, tokens, and shared primitives   | UI foundation plus host boundaries |
| Integrated compositions and catalog aggregation | Picodash                           |
| Routing, data transport, authorization          | Application                        |

Picodash must not solve foundation defects with facade-only state or compatibility shims.

## Default integrated Panel menu

> Contract: Accepted
> Implementation: Planned

`PicodashProvider` installs a package-private `DashPanelDefaultActionItems` component through
`@picodash/dashpanel/integration`. For a Panel with an active primary same-scope DashList, that
component renders the exact DashList-owned `DashListActionItems`, followed by a separator, before
the Panel-owned placement and layout actions. The resulting default order is:

1. DashList disclosure, document, and reset actions;
2. a separator; and
3. DashPanel placement and layout-reset actions.

Only the primary DashList whose scope equals the Panel's resolved `scopeId` contributes
automatically. Additional child-scoped Lists are never inferred into these same-scope actions.

| Panel `actionMenu` value        | Integrated result                                        |
| ------------------------------- | -------------------------------------------------------- |
| `undefined`                     | Same-scope DashList contribution, then Panel defaults.   |
| `false`                         | No action menu or contributed actions.                   |
| `readonly ReactElement[]`       | Caller items replace every contributed and default item. |
| Empty `readonly ReactElement[]` | No trigger.                                              |

A custom array may explicitly compose `DashListActionItems` or its individual public action items.
The contribution receives only the resolved Panel `scopeId`; it does not receive a private
controller or runtime object. If the contributing DashList disappears while focus is within the
open menu, the menu closes and restores focus to its connected trigger rather than leaving a
focused action with no owner.

## Additional List actions

> Contract: Accepted
> Implementation: Planned

Picodash performs no implicit descendant action aggregation. Mounting, unmounting, or reordering an
additional List never changes the primary List targeted by the default Panel menu. Additional Lists
retain the ordinary DashList action surface and may expose their own header menu or be targeted by
an application-supplied Panel menu.

There is no default “all Lists in this Panel” submenu, combined reset, or descendant export. Nexus's
explicit descendant-capable operations remain available to applications building a reviewed custom
workflow, but a declarative relationship alone never grants that broader target to Picodash chrome.

## Ready-made Dashlets and catalogs

> Contract: Accepted ownership, initial inventory, and export paths
> Implementation: Partial

DashList owns generic Nexus-bound ready-made Dashlets and their catalog metadata. Picodash may
reexport stable DashList components and aggregate package-owned catalogs, but it does not maintain
facade copies of their implementations or entries. DashPanel owns no Dashlets. The 22 stable
DashList-owned root reexports are implemented with identity-preserving facade exports; catalog
aggregation remains planned.

Picodash owns no ready-made Dashlet or additional component family at initial launch. A future
component belongs to Picodash only when its behavior necessarily coordinates both DashPanel and
DashList. Field binding and List presentation remain DashList concerns; product-neutral presentation
remains UI-owned. A qualifying Picodash component is documented as an integrated composition rather
than a foundational Dashlet.

Picodash reexports the exact stable DashList-owned inventory from its root: `TextDashlet`,
`NumberDashlet`, `SliderDashlet`, `SwitchDashlet`, `SelectDashlet`, `SegmentedDashlet`,
`DisplayDashlet`, `CheckboxDashlet`, `RadioGroupDashlet`, `ComboboxDashlet`,
`CheckboxGroupDashlet`, `MultiSelectDashlet`, `SearchDashlet`, `RangeDashlet`, `MeterDashlet`,
`ProgressDashlet`, `StatusDashlet`, `DateDashlet`, `TimeDashlet`, `DateTimeDashlet`,
`DateRangeDashlet`, and `ColorDashlet`. It combines foundation metadata through
`@picodash/picodash/catalog`. Experimental chart subpath exports are not root reexports or catalog
entries. DashList anatomy remains available only from its owning subpath; the facade does not add a
`/dashlet` convenience surface.

An optional family with a meaningful third-party runtime dependency ships as a separate package,
not as a required Picodash dependency or root reexport. Its package name, dependency policy, public
API, and catalog are accepted with that family's focused contract. The core facade does not reserve
placeholder exports or a runtime registry for hypothetical families.

Catalogs remain descriptive discovery metadata and never become runtime registration or authority.
Picodash publishes one owned entry for `PicodashProvider`, combines the exact deeply frozen
DashPanel and DashList entry objects, and records facade import paths as reexports rather than copied
entries. The exact versioned schema, entry requirements, exclusions, and artifact checks are
accepted in the [component catalog reference](catalog.md). There is no catalog registry, query API,
component loader, prop-schema copy, or initial UI-foundation catalog.

## Theme integration

> Contract: Accepted
> Implementation: Partial

`@picodash/ui` is the sole theme and density authority. The axes remain separate:

```ts
theme?: 'light' | 'dark' | 'system' | CustomTheme
density?: 'regular' | 'compact'
```

`compact` is never a theme name. There are no `light-compact`, `dark-compact`, or `brand-compact`
recipes. `system` reacts to the platform color preference and resolves only to `light` or `dark`;
custom theme names do not acquire implicit system variants.

The alpha `@picodash/picodash/style.css` is a three-import facade stylesheet that references the
public UI, DashPanel, and DashList styles once each. The final expanded-CSS and exact-once artifact
claim remains pending the owning foundation release gates. Picodash introduces no additional
semantic token, theme resolver, or density recipe.

Applications load custom theme CSS after the facade stylesheet. A named custom theme defines all 24
shared color tokens and an appropriate CSS `color-scheme` under its
`data-picodash-theme="name"` selector; non-color roles continue using the shared defaults unless the
application deliberately overrides their public tokens. Applications wanting a partial local
restyle may instead override an existing built-in selector. There is no JavaScript theme registry,
palette object, merge API, or `themes` Provider prop.

The website's `ocean`, `plum`, `tron`, and `contrast` themes remain application examples and are not
exported by any package. Provider, Panel, List, and detached-root inheritance retains the accepted
UI contract. Theme and density are controlled presentation inputs and Picodash does not persist
either automatically.

## DashList rail integration

> Contract: Accepted
> Implementation: Planned

Picodash may present a DashList as an icon rail inside a DashPanel. The Panel's current dock position
supplies an active Nexus orientation override for unambiguous main-edge positions:
`full/center-left` and `full/center-right` force vertical, while `full/center-top` and
`full/center-bottom` force horizontal. Corner, free, and snapped positions supply no Picodash
override. A corner rail therefore retains the effective Nexus or DashList-prop orientation without
persisting dock-derived presentation as a second layout preference.

Rail groups preserve their ordinary disclosure and collapse behavior. Long press may enter the
List's transient reorder mode, but Dashlet activation alone reveals content or directly operates a
toggle Dashlet; it never changes Panel placement.

Picodash composes DashList-owned List behavior actions such as `Expand all`, `Collapse all`, and the
accepted reset actions into integrated Panel menus. It reuses those exports and their Nexus
semantics rather than implementing facade copies. Generic menu composition comes from UI;
DashPanel owns only Panel-specific actions and their integration into Panel chrome.

The reusable DashList surface is `useDashListActions(scopeId?)`, `DashListActionItems`, the two
named expand/collapse items, and the named Reset submenu/items. A primary List can be targeted with
the Panel's current scope even when the Panel action menu is outside the List's React ancestry.
An additional List is targeted only by its explicit scope ID.

The DashList-owned reset actions are `Reset values…` and `Reset list…`. Picodash adds no combined,
descendant, or Panel-wide reset action at initial launch.

### Effective rail edges

A corner rail's orientation selects one of its two adjoining physical edges. For example,
`top-left + horizontal` follows the top edge, while `top-left + vertical` follows the left edge. The
other three corners map symmetrically. The effective edge determines the rail's ordering axis,
autoscroll axis, keyboard direction, and content-reveal direction.

An orientation change atomically reclassifies a corner rail into its new effective edge. It cancels
an active drag before updating geometry, `aria-orientation`, keyboard behavior, and drop
calculations together. Rail reorder mode itself may remain active.

### Integrated rail allocation

> Contract: Accepted
> Implementation: Planned

Picodash coordinates rail allocation at the dock-arena level; neither DashPanel nor DashList imports
the other product or calculates peer geometry independently. Allocation is transient, derived from
committed occupancy, effective rail edges, and resolved intrinsic cross-axis thickness. It is never
persisted or exported.

For two rails following both corners of the same top or bottom edge, each receives at most one-half
of the available container width. The symmetric rule applies to vertical rails following both
corners of the same left or right edge, using available container height. Allocations are maxima:
rails retain intrinsic size and scroll on their main axis when content exceeds the assigned span.

When the two physical corners on one edge contain perpendicular rails, the rail following that edge
may grow up to the inner edge of the perpendicular rail. For example, a horizontal top-right rail
may extend leftward to the inner edge of a vertical top-left rail. The same accommodation applies
after rotating the scenario around every side of the arena.

When both physical corners and the main slot on one edge are occupied by rails, Picodash stops
trying to recover additional space and assigns at most one-third to each occupant. This rail-specific
allocation supersedes the ordinary overlap behavior of `center-top` and `center-bottom`; non-rail
center Panels retain the DashPanel z-index contract. One corner plus a full main rail uses
one-third plus two-thirds. One corner plus a center main rail uses one-third plus one-third and leaves
the opposite third empty.

Cross-axis thickness is resolved before main-axis span so perpendicular accommodations cannot form
a circular sizing dependency. A committed occupancy or orientation change recomputes the complete
arena allocation rather than preserving a previous larger cap.

## Documents

> Contract: Accepted through Nexus and DashList
> Implementation: Prototype migration required

Nexus owns document schema, policy, validation, mapping, and atomic commit. Picodash composes
document actions into Panel/List UI and may provide user-facing preview and confirmation dialogs.

DashList already owns the standalone current-scope JSON workflow through
`useDashListDocumentActions(scopeId?)`, `DashListDocumentItems`, `DashListExportItem`, and
`DashListImportItem`. Picodash reuses those exports for the primary List and does not add implicit
descendant, multi-List, or root-document UI at initial launch. An application may build an explicit
advanced workflow from Nexus document plans. Any future integrated workflow for interactive
mappings, missing-scope creation, or several explicit targets remains Picodash-owned and requires a
separate contract.

The reused primary-List workflow retains the accepted DashList requirements to:

- show target scopes and shared-field effects;
- mask values according to target disclosure policy;
- distinguish redacted, omitted, unchanged, and included entries;
- require confirmation for permitted sensitive promotion;
- show foreign Nexus/schema warnings;
- never imply global atomic observation across an external host store and Picodash metadata.

## Package facade

| Surface                        | Contract | Implementation | Notes                                       |
| ------------------------------ | -------- | -------------- | ------------------------------------------- |
| `@picodash/picodash`           | Accepted | Partial        | Alpha root exports and Provider delegation. |
| `@picodash/picodash/ui`        | Accepted | Partial        | Explicit reexports of stable shared UI.     |
| `@picodash/picodash/catalog`   | Accepted | Planned        | Aggregates package-owned catalogs.          |
| `@picodash/picodash/style.css` | Accepted | Partial        | Public UI, DashPanel, and DashList imports. |

The root uses named reexports and exposes no `Picodash*` aliases for foundation-owned components.
The facade does not fork their types or behavior. Its `/ui` entrypoint explicitly mirrors the
accepted `@picodash/ui` inventory, never the lower-level owner consumed by DashPanel or DashList.
Product-specific DashList controls retain their owning package surfaces even when Picodash
reexports them separately.

There is no initial `@picodash/picodash/advanced` or `@picodash/picodash/dashlet` entrypoint.
Advanced Nexus inspection remains Nexus-owned, DashList anatomy remains DashList-owned, and
Picodash does not publish convenience aliases that obscure either owner.

## Public examples and host recipes

> Contract: Accepted inventory and support boundary
> Implementation: Planned

The documentation publishes four canonical executable examples in this order:

1. **Nexus-owned values and persistence** — defines typed fields, performs a validated write, reads
   with a selector, and reloads Nexus-owned values plus Picodash metadata.
2. **Standalone DashPanel inspector** — hosts arbitrary inspector content in a movable Panel,
   demonstrates reopening, and persists only settled layout metadata.
3. **Standalone DashList settings** — binds typed ready-made Dashlets, includes one collapsible
   DashGroup, and demonstrates durable order/collapse overrides without DashPanel.
4. **Integrated Picodash settings** — renders one DashPanel with its id-less same-scope primary
   DashList and shows the default combined action menu.

These are maintained fixtures, not illustrative pseudocode. They import only accepted public
entrypoints, include the owning stylesheet path, typecheck with the packages, and avoid prototype
aliases or private imports.

Four focused recipes cover supported host decisions without creating more canonical product paths:

1. **Use an existing application store** — supplies the synchronous manual external-value adapter,
   leaving application values with the host while Picodash Nexus persists only Picodash metadata.
2. **Define a named theme** — supplies all shared color tokens and `color-scheme`, then demonstrates
   the same custom theme at both regular and compact density.
3. **Build a canvas editor palette** — uses one same-scope primary property List and one explicitly
   identified child tool rail without aggregating the secondary List into Panel actions.
4. **Choose a drawer or sheet in the host** — selects DashPanel's transient modal presentation from
   application viewport policy and restores the same desktop layout when returning to `panel`.

The baseline is React 19 and framework-neutral component code. The Next.js App Router note is
limited to placing interactive composition behind a client boundary and importing package CSS from
an allowed global stylesheet entry. The initial documentation does not maintain separate recipes
for every React framework or application state library.

Zustand, Redux, Jotai, and similar hosts use the manual adapter contract. Picodash does not claim an
official named adapter until that adapter is independently packaged and tested. Website-only themes
and Lab fixtures are labelled as examples and never implied to be package exports.

The integrated example owns one cohesive website E2E journey. Foundation examples use compile-time,
component, and package checks at their cheapest faithful layer; they do not each acquire a duplicate
browser journey.

## Integration verification

Picodash tests prove cross-product seams rather than repeating foundation matrices. Priority
integration evidence includes:

- Provider root context reaching Panel and List;
- same-scope Panel/List composition;
- explicit child-scope relationships;
- additional Lists leaving the primary action target unchanged;
- shared field effects across Lists;
- portal/theme/focus behavior with Dashlets;
- package exports and one complete public example.

## Implementation readiness

No unresolved Picodash launch-contract question blocks its later integration phase. Implementation
remains sequenced after stable Nexus, DashPanel, and DashList releases. Facade conformance must still
produce package artifacts, catalog integrity, the four public examples, and the focused integration
evidence above.

## Related documents

- [Picodash value proposition](../product/value-propositions.md#picodash)
- [Shared UI target reference](ui.md)
- [Nexus target reference](nexus.md)
- [DashPanel target reference](dashpanel.md)
- [DashList target reference](dashlist.md)
- [Component catalog target reference](catalog.md)
- [Roadmap](../ROADMAP.md)
