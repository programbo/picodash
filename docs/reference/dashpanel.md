# DashPanel target reference

DashPanel is a standalone React panel shell for movable, dockable, dismissible application UI. This
page records the provisional `@picodash/dashpanel` contract. The prototype is evidence, not the
source of truth.

## Status

> Contract: Draft
> Implementation: Prototype
> Evidence: The product boundary and provisional behavior baseline are accepted; current exports
> and geometry have not been reconciled with it.
> Notes: “Draft” is the repository status for this reviewed provisional contract. Remaining work is
> limited to the exact public prop/type inventory, CSS consumption audit, and implementation
> conformance—not unresolved product ownership or placement behavior.

## Package purpose

DashPanel renders arbitrary React content in a host-coordinated Panel without requiring DashList.
It owns Panel composition, placement, portals, accessible actions, transient host runtime, and the
translation between Panel behavior and Store-owned durable layout records.

Store owns durable layout data and scope identity. `@picodash/theme` owns shared semantic theme
tokens. DashPanel does not own application values, DashList composition, routing, authorization, or
permanent component removal.

## Target composition

```tsx
const store = createPicodashStore({
  storeId: 'tools',
  schemaVersion: 1,
  valueOwner: 'store',
  fields: {},
})

function Tools() {
  return (
    <DashPanelProvider store={store}>
      <DashPanel id="inspector" title="Inspector">
        <Inspector />
      </DashPanel>
    </DashPanelProvider>
  )
}
```

| API                 | Contract | Implementation | Purpose                                                  |
| ------------------- | -------- | -------------- | -------------------------------------------------------- |
| `DashPanelProvider` | Accepted | Planned        | Hosts Panels over one explicit root Store.               |
| `DashPanel`         | Accepted | Planned        | Renders one Panel with arbitrary React content.          |
| `DashPanelTrigger`  | Accepted | Planned        | Application-placed show/focus control for one Panel.     |
| `DashPanelLauncher` | Accepted | Planned        | Provider-level discovery/reopen control for its Panels.  |
| `useDashPanel`      | Accepted | Planned        | Controls declared visibility, collapse, and activation.  |
| `id`                | Accepted | Prototype      | Resolves immutable Store scope identity; not a DOM `id`. |
| `title`             | Accepted | Prototype      | Required accessible Panel name and visible heading.      |
| `children`          | Accepted | Prototype      | Arbitrary React content.                                 |

The package-native names are the target. `PicodashProvider` and `PicodashPanel` remain prototype
and integrated-facade evidence, not a second standalone API.

DashPanel does not accept an independent `store` prop. `DashPanelProvider` supplies a root Store,
and each Panel supplies its scoped view to descendants. The integrated Picodash facade may reexport
the stable foundational components and provides its own integration Provider composition.

## Provider contract

| Provider capability       | Contract | Implementation | Rule                                                    |
| ------------------------- | -------- | -------------- | ------------------------------------------------------- |
| Required root `store`     | Accepted | Planned        | Scoped Stores are rejected.                             |
| `providerId="default"`    | Accepted | Planned        | Omission resolves to `default`; duplicates conflict.    |
| Hard Store/scope boundary | Accepted | Planned        | No relationship or inferred scope crosses the Provider. |
| Shared `boundary`         | Accepted | Prototype      | Defaults Panel geometry; viewport when unresolved.      |
| Shared `boundaryInset`    | Accepted | Prototype      | Defines the effective geometry rectangle.               |
| Dock-position policy      | Accepted | Planned        | Maximum set that descendant Panels may narrow.          |
| Portal ownership          | Accepted | Prototype      | Independent of the geometry boundary.                   |
| Theme                     | Accepted | Prototype      | Inherits or resolves a named theme for descendants.     |

The root Store and `providerId` are immutable while mounted. Theme, boundary, inset, and enabled
dock positions are runtime policy and may change through their declared props.

More than one Provider may use a root Store, but each requires a distinct Provider ID. Provider IDs
do not namespace scopes. The same Panel scope cannot be active in two Providers over one root.

## Scope and declarative lifecycle

> Contract: Accepted
> Implementation: Planned

- One active DashPanel is permitted per scope.
- A Panel and one primary DashList may share a scope.
- A Panel resolving a different scope from its nearest scoped context registers an active
  declarative parent-child relationship.
- Store entity and relationship leases follow committed React lifecycle.
- Hiding or collapsing a Panel does not release its entity, relationship, or dock occupancy.
- Effect deactivation and unmount release runtime leases. Permanent removal is application-owned
  unmounting.
- Imperative `deregister` close behavior is retired.

## Panel anatomy and visibility

DashPanel renders a non-modal `aside` with a required title, generated accessible relationships,
header actions, and a body for arbitrary children. Scope `id` never doubles as an HTML `id`; DOM
identifiers are generated independently.

The first public contract is Provider-owned uncontrolled visibility and collapse:

- `defaultVisible` and `defaultCollapsed` seed transient state;
- callbacks report committed visibility and collapse changes;
- `DashPanelTrigger`, `DashPanelLauncher`, and `useDashPanel` control that state;
- a controlled `visible` prop is deferred until a concrete consumer requires it.

A hidden Panel remains mounted, retains child React state and all leases, is absent visually and
from the accessibility tree, and is inert. A collapsed floating or snapped Panel reduces to its
header. A collapsed docked Panel retreats to the boundary while leaving a reachable reveal control.
Collapse and visibility are transient and never persisted.

## Placement model

Placement mode describes the permitted behavior model. Disposition describes the current settled
result.

| Mode       | Permitted dispositions                                                    |
| ---------- | ------------------------------------------------------------------------- |
| `floating` | Free or snapped to any corner or edge midpoint.                           |
| `fixed`    | Docked to any position enabled by current Provider and Panel policy.      |
| `hybrid`   | Free, snapped to top/bottom, or docked to any currently enabled position. |

Free Panels are contained within the effective boundary. Snaps are offset and floating-like. Docks
are flush and fixed-like. Hybrid docking intent animates an independent proxy and commits only on
release. Detaching a docked Hybrid Panel preserves Hybrid mode.

### Canonical positions

```ts
type DashPanelSnapPosition =
  'top-left' | 'top' | 'top-right' | 'right' | 'bottom-right' | 'bottom' | 'bottom-left' | 'left'

type DashPanelDockPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-right'
  | 'bottom-left'
  | 'full-left'
  | 'center-left'
  | 'full-right'
  | 'center-right'
  | 'full-top'
  | 'center-top'
  | 'full-bottom'
  | 'center-bottom'
```

`center-left` and `center-right` replace the prototype terms `middle-left` and `middle-right`.
Floating ignores dock-position policy.

Standalone DashPanel enables every dock position for Fixed and Hybrid Panels by default. Provider
policy declares the maximum set; an individual Panel may narrow that set but cannot widen it.

The integrated Picodash policy initially disables `full-top`, `center-top`, `full-bottom`, and
`center-bottom`. This preserves Picodash's fixed-width column form while retaining top/bottom snaps:

- Fixed Picodash Panels allow corners, `full-left/right`, and `center-left/right`.
- Hybrid Picodash Panels allow corners and `full-left/right`.

Disabling a position is a host policy decision, not evidence that a stored layout is corrupt. A
valid persisted target that is unavailable under current policy remains durable and dormant. The
Panel uses its contained declared fallback without rewriting the record.

## Dock occupancy and allocation

Docking coordinates multiple Fixed and Hybrid Panels within a Provider. These terms are canonical:

- **Dock position:** one named placement target such as `top-left` or `full-right`.
- **Dock arena:** Panels with the same Provider, resolved boundary identity, and resolved inset.
- **Dock slot:** the collision identity claimed by a docked Panel.
- **Dock occupancy:** the active runtime lease between a Panel and a dock slot.
- **Dock allocation:** the runtime size cap assigned to occupants sharing an edge.

Occupancy and allocation are host runtime, not Store metadata.

### Occupancy rules

1. Only one Panel may occupy an exact dock position in one arena.
2. `full-left` and `center-left` share one main-left slot; `full-right` and `center-right` share one
   main-right slot. A full and center Panel therefore cannot occupy the same side simultaneously.
3. `full-top` and `center-top` share one main-top slot; `full-bottom` and `center-bottom` share one
   main-bottom slot.
4. A visible, hidden, or collapsed mounted Panel retains its slot. Unmount releases it.
5. Occupancy applies equally to Fixed and Hybrid Panels.
6. Orthogonal edge slots may coexist. Where their rendered rectangles overlap, ordinary Provider
   activation and z-index rules decide which Panel is above.

During pointer or keyboard movement, an occupied target is not offered as a valid intent proxy.
Releasing over it preserves the Panel's previous settled placement. A programmatic placement
command fails atomically with structured reason `dock_occupied`.

During persisted-layout materialization, the first committed lease wins. A later conflicting Panel
uses a contained, non-durable fallback and reports the conflict. It does not silently overwrite the
record or jump into the slot if it later becomes free; the application or user must request another
placement.

### Side allocation rules

The following allocation caps apply independently to the left and right sides of an arena. “Corner”
means the top or bottom corner on that side; “main” means that side's `full-*` or `center-*` slot.

| Occupants on one side            | Maximum allocation along container height                          |
| -------------------------------- | ------------------------------------------------------------------ |
| Full main slot only              | Fills the side.                                                    |
| Center main slot only            | Retains intrinsic height up to the available side height.          |
| One corner only                  | Corner may grow up to **2/3**.                                     |
| Top and bottom corners           | Up to `1/2 + 1/2`.                                                 |
| One corner plus a full main slot | Corner up to `1/3`; full main slot receives the remaining `2/3`.   |
| One corner plus a center slot    | Corner up to `1/3`; center slot up to `1/3`; opposite third empty. |
| Two corners plus either main     | `1/3 + 1/3 + 1/3`.                                                 |

The two-thirds single-corner cap replaces the earlier one-half proposal. Adding or removing an
occupant recomputes the complete side allocation; a corner does not retain a previous larger cap.

Allocations are maxima, not persisted sizes. Corner and center Panels retain intrinsic size until
they reach their cap. A full side Panel stretches through its allocation. When content exceeds its
allocation, the Panel body scrolls while its header and reveal affordance remain reachable.

### Top and bottom edge behavior

- `full-top` and `full-bottom` retain intrinsic height and fill the available horizontal span.
- Their span reaches the effective container edge or stops at the inner edge of an occupied corner
  on that top or bottom edge.
- `center-top` and `center-bottom` retain intrinsic width and center against the whole effective
  boundary.
- Center top/bottom Panels may overlap side or corner Panels and follow ordinary z-index behavior.
- Full top/bottom Panels may intersect orthogonal full-side Panels; ordinary z-index behavior
  resolves the overlap unless a future reviewed contract introduces a different explicit tiling
  rule.

## Boundaries, insets, and portals

> Contract: Accepted
> Implementation: Prototype

Boundary resolution follows Panel override, Provider default, then viewport. Explicit `null`
selects the viewport; an unresolved ref falls through to the next boundary. Provider and Panel
boundaries are Element/ref contracts, not selector strings.

Inset resolution follows Panel override, Provider default, then zero. Insets constrain free
placement and define the flush docking rectangle. Snaps apply their separate offset after inset
resolution. Insets and boundary objects are runtime policy and are not persisted.

Portal ownership and geometry boundary are independent. Changing a portal target must not change
placement coordinates; changing a boundary must not implicitly move ownership of the Panel DOM.

## Durable layout

> Contract: Accepted
> Implementation: Prototype

Store persists one settled layout override per Panel scope:

```ts
type DashPanelLayoutRecord = {
  placement: DashPanelPlacement
  preferredPosition: { x: number; y: number }
}
```

`preferredPosition` contains finite CSS-pixel offsets from the effective boundary's top-left after
inset and before snap offset. It preserves the preferred contained free position through snapping
or docking and gives Hybrid detachment a stable destination.

Store does not persist resolved size, visibility, collapse, focus, activation, z-order, drag proxy,
occupancy, allocations, allocation ratios, peer identity, boundary object, inset, enabled positions,
fallback layout, or responsive projection.

A completed move, snap, or dock writes the override. Cancellation writes nothing.
`resetDashPanelLayout()` removes it so the current declared `defaultLayout` applies. A record with
an unknown position, an invalid mode/disposition combination, or non-finite coordinates enters
Store recovery; a valid record merely disabled by current UI policy remains dormant.

## Resize and responsive behavior

DashPanel does not offer user resizing in its initial contract. It observes intrinsic content and
boundary size changes and recomputes containment and dock allocations. Resolved size is never
persisted.

Responsive behavior is geometry-derived rather than breakpoint-driven:

- the visual viewport is the viewport boundary;
- free geometry is projected into the current effective boundary without changing its durable
  preferred position;
- intrinsic content is capped to available space and the body scrolls;
- changing boundary, inset, zoom, or viewport during an active movement cancels the interaction and
  writes no stale result;
- current policy may temporarily make a durable target unavailable without deleting it.

There is no automatic mode switch at a product-defined breakpoint.

## Pointer, keyboard, and focus

> Contract: Accepted
> Implementation: Partial

Pointer and keyboard operations must reach the same canonical placements and reject the same
occupied targets. Pointer movement uses capture, contained unsnapped Panel geometry, and current
pointer position. A Hybrid proxy is visual intent only and never becomes the input to geometry.

Keyboard movement uses the Panel's move control:

- `Enter` or `Space` enters movement mode;
- arrow keys move by 1 CSS pixel;
- `Shift` plus an arrow moves by 10 CSS pixels;
- `Enter` commits;
- `Escape` restores the pre-interaction layout and writes nothing;
- a placement submenu provides direct snap and dock choices, subject to current policy and
  occupancy.

Showing a Panel does not steal focus. Hiding restores focus first to the most recent connected
trigger, then to the connected element focused before Panel interaction, then to a Provider fallback.
Closing a menu restores its trigger. Reduced-motion preference removes non-essential movement while
preserving state feedback.

## Close and removal

| Operation                 | Contract | Implementation | Behavior                                    |
| ------------------------- | -------- | -------------- | ------------------------------------------- |
| Hide/close                | Accepted | Prototype      | Changes transient visibility.               |
| Reopen                    | Accepted | Prototype      | Restores visibility without remounting.     |
| Request permanent removal | Accepted | Planned        | Notifies application; application unmounts. |
| Imperative deregistration | Rejected | Prototype      | Legacy behavior removed during conformance. |

Permanent-removal request callback naming remains part of the final prop inventory. It does not
grant DashPanel authority to unmount application JSX.

## Action menu

The built-in DashPanel menu contains only Panel-owned placement and layout-reset actions. Value
reset, group expansion, copy, import, export, and disclosure policy belong to DashList, Store, or
integrated Picodash composition.

| Configuration                      | Contract | Behavior                                               |
| ---------------------------------- | -------- | ------------------------------------------------------ |
| `actionMenu` omitted               | Accepted | Standard trigger with built-in Panel actions.          |
| `actionMenu={false}`               | Accepted | Hides the menu.                                        |
| `actionMenu={readonly elements[]}` | Accepted | Standard root wraps caller-provided public menu items. |
| Caller-replaced root trigger       | Deferred | Advanced surface only after a demonstrated need.       |

DashPanel exports the menu item, submenu, separator, and built-in placement/reset components needed
to compose the accepted custom-content path. They use public controller commands and must not
mutate Store or Provider internals.

## Theme and CSS design tokens

> Contract: Accepted
> Implementation: Prototype
> Notes: Theme ownership and behavior are accepted. The exhaustive consumed-token inventory remains
> Draft until checked against the extracted package.

`@picodash/theme` owns `dark`, `light`, `system`, custom named-theme resolution, and all shared
semantic tokens. `DashPanelProvider` establishes the inherited theme; a Panel may override it.
Theme is runtime presentation and is never persisted. Portaled Panel-owned roots repeat the resolved
theme attribute; their descendants inherit.

Custom themes override public `--picodash-*` tokens under their named theme selector. Consumers must
not rely on `--_picodash-*` variables, which are package-private derived values.

The provisional DashPanel shell consumes this public inventory. Each row is repeated here even when
the token is shared with DashList so a DashPanel-only consumer has a complete reference.

| Variable                         | Purpose                             | Syntax                | Default                           | Owner                 |
| -------------------------------- | ----------------------------------- | --------------------- | --------------------------------- | --------------------- |
| `--picodash-color-surface`       | Panel background.                   | `<color>`             | Active theme recipe               | `@picodash/theme`     |
| `--picodash-color-surface-muted` | Hovered and secondary chrome.       | `<color>`             | Active theme recipe               | `@picodash/theme`     |
| `--picodash-color-text`          | Primary Panel text.                 | `<color>`             | Active theme recipe               | `@picodash/theme`     |
| `--picodash-color-text-muted`    | Secondary labels and status text.   | `<color>`             | Active theme recipe               | `@picodash/theme`     |
| `--picodash-color-border`        | Panel and control boundaries.       | `<color>`             | Active theme recipe               | `@picodash/theme`     |
| `--picodash-color-focus`         | Keyboard focus indication.          | `<color>`             | Active theme recipe               | `@picodash/theme`     |
| `--picodash-color-danger`        | Destructive action emphasis.        | `<color>`             | Active theme recipe               | `@picodash/theme`     |
| `--picodash-color-overlay`       | Confirmation-dialog backdrop.       | `<color>`             | Active theme recipe               | `@picodash/theme`     |
| `--picodash-font-family`         | Panel typography family.            | font-family value     | `inherit`                         | `@picodash/theme`     |
| `--picodash-font-size-xl`        | Panel title size.                   | `<length>`            | `0.875rem`                        | `@picodash/theme`     |
| `--picodash-font-semibold`       | Panel title weight.                 | `<number>`            | `600`                             | `@picodash/theme`     |
| `--picodash-space-1`             | Compact icon/control gaps.          | `<length>`            | `0.25rem`                         | `@picodash/theme`     |
| `--picodash-space-2`             | Header and action spacing.          | `<length>`            | `0.5rem`                          | `@picodash/theme`     |
| `--picodash-space-3`             | Panel body spacing.                 | `<length>`            | `0.75rem`                         | `@picodash/theme`     |
| `--picodash-radius-surface`      | Panel corner radius.                | `<length>`            | `0`                               | `@picodash/theme`     |
| `--picodash-radius-control`      | Action-control corner radius.       | `<length>`            | `0`                               | `@picodash/theme`     |
| `--picodash-control-height-md`   | Standard header action height.      | `<length>`            | `2rem`                            | `@picodash/theme`     |
| `--picodash-icon-sm`             | Compact action icon size.           | `<length>`            | `0.875rem`                        | `@picodash/theme`     |
| `--picodash-icon-lg`             | Primary Panel action icon size.     | `<length>`            | `1.25rem`                         | `@picodash/theme`     |
| `--picodash-shadow-md`           | Menu and raised action shadow.      | shadow list           | `0 4px 12px rgb(0 0 0 / 25%)`     | `@picodash/theme`     |
| `--picodash-shadow-panel`        | Panel elevation.                    | shadow list           | Active theme recipe               | `@picodash/theme`     |
| `--picodash-duration-fast`       | Menu and state transition duration. | `<time>`              | `150ms`                           | `@picodash/theme`     |
| `--picodash-ease-out`            | Menu and state transition easing.   | easing function       | `cubic-bezier(0, 0, 0.2, 1)`      | `@picodash/theme`     |
| `--picodash-layer-drag`          | Movement proxy layer.               | `<integer>`           | `20`                              | `@picodash/theme`     |
| `--picodash-layer-tooltip`       | Tooltip overlay layer.              | `<integer>`           | `50`                              | `@picodash/theme`     |
| `--picodash-layer-menu`          | Action-menu overlay layer.          | `<integer>`           | `70`                              | `@picodash/theme`     |
| `--picodash-layer-dialog`        | Confirmation-dialog overlay layer.  | `<integer>`           | `80`                              | `@picodash/theme`     |
| `--picodash-panel-width`         | Preferred intrinsic Panel width.    | `<length-percentage>` | `min(20rem, calc(100dvw - 2rem))` | `@picodash/dashpanel` |

Before this section becomes Accepted as an exhaustive inventory, a conformance check must prove
that every consumed public variable is documented and every documented variable is consumed or
deliberately inherited. DashList maintains its own complete consumed-token table, including shared
rows.

## React runtime hooks

DashPanel exposes high-level control rather than mutable runtime internals:

| Hook purpose                 | Contract | Rule                                                      |
| ---------------------------- | -------- | --------------------------------------------------------- |
| Control one mounted Panel    | Accepted | Visibility, collapse, activation, and placement commands. |
| Select Provider runtime      | Draft    | Read-only advanced selector; no mutable internals.        |
| Select nearest Panel runtime | Draft    | Separate from scoped Store selection.                     |
| Access nearest scoped Store  | Accepted | Use `@picodash/store/react`; nearest Store context wins.  |

Selector equality and Store context behavior belong to the Store React contract. DashPanel does not
create a second value-subscription model.

## Remaining finalization work

The provisional behavior contract is complete enough to move to the DashList review. Before the
DashPanel contract can change from Draft to Accepted, the implementation plan must still freeze:

1. the exact prop and exported type names corresponding to the behaviors above;
2. the permanent-removal callback name and read-only advanced selector names;
3. the exhaustive CSS token inventory after package extraction; and
4. conformance evidence links proving the target rather than the prototype.

These items may refine naming and packaging. They must not reopen Store ownership, declarative
lifecycle, placement semantics, dock occupancy/allocation, responsive policy, persistence,
accessibility, or action ownership without an explicit contract revision.

## Related documents

- [DashPanel value proposition](../product/value-propositions.md#dashpanel)
- [Store target reference](store.md)
- [Store decisions](store-contract-decisions.md)
- [Contract conformance](contract-conformance.md)
- [Roadmap](../ROADMAP.md)
