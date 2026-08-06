# DashPanel target reference

DashPanel is a standalone React panel shell for movable, dockable, dismissible application UI. This
page records the accepted `@picodash/dashpanel` launch contract. The prototype is evidence, not the
source of truth.

## Status

> Contract: Accepted, with revised HTML portal-container type
> Implementation: Partial
> Evidence: The first standalone shell subset is covered by
> `packages/dashpanel/tests/dashpanel.test.tsx`, `dashpanel.types.test.ts`, and
> `package-artifacts.mjs`.
> Notes: This cut implements only Provider/Panel composition, shared DashHeader and ActionMenu
> reexports, Store scope boundaries, theme/density composition, semantic naming, and width-token
> styling. Placement, lifecycle controls, persistence, modal projections, catalogs, and later
> package entries remain unimplemented.

## Package purpose

DashPanel renders arbitrary React content in a host-coordinated Panel without requiring DashList.
It owns Panel composition, placement, portals, accessible actions, transient host runtime, and the
translation between Panel behavior and Store-owned durable layout records.

Store owns durable layout data and scope identity. `@picodash/ui` owns shared theme and density
contracts, semantic tokens, and product-neutral primitives. DashPanel does not own application
values, DashList composition, routing, authorization, or permanent component removal.

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
| `DashPanelProvider` | Accepted | Partial        | Hosts Panels over one explicit root Store.               |
| `DashPanel`         | Accepted | Partial        | Renders one Panel with arbitrary React content.          |
| `DashPanelTrigger`  | Accepted | Planned        | Application-placed show/focus control for one Panel.     |
| `DashPanelLauncher` | Accepted | Planned        | Provider-level discovery/reopen control for its Panels.  |
| `useDashPanel`      | Accepted | Planned        | Controls declared visibility, collapse, and activation.  |
| `id`                | Accepted | Implemented    | Resolves immutable Store scope identity; not a DOM `id`. |
| `title`             | Accepted | Implemented    | Required accessible Panel name and visible heading.      |
| `children`          | Accepted | Implemented    | Arbitrary React content.                                 |

The package-native names are the target. `PicodashProvider` and `PicodashPanel` remain prototype
and integrated-facade evidence, not a second standalone API.

DashPanel does not accept an independent `store` prop. `DashPanelProvider` supplies a root Store,
and each Panel supplies its scoped view to descendants. The integrated Picodash facade may reexport
the stable foundational components and provides its own integration Provider composition.

## Provider contract

| Provider capability       | Contract | Implementation | Rule                                                                             |
| ------------------------- | -------- | -------------- | -------------------------------------------------------------------------------- |
| Required root `store`     | Accepted | Implemented    | Scoped Stores are rejected.                                                      |
| `providerId="default"`    | Accepted | Implemented    | Omission resolves to `default`; duplicates conflict.                             |
| Hard Store/scope boundary | Accepted | Implemented    | No relationship or inferred scope crosses the Provider.                          |
| Shared `boundary`         | Accepted | Partial        | Pure resolver covers direct/ref precedence; viewport and geometry wiring remain. |
| Shared `boundaryInset`    | Accepted | Partial        | Public inset vocabulary exists; normalization and geometry remain planned.       |
| Dock-position policy      | Accepted | Planned        | Maximum set that descendant Panels may narrow.                                   |
| Portal ownership          | Accepted | Partial        | Shared overlay defaults are composed; Panel portal ownership is later work.      |
| Theme                     | Accepted | Partial        | Inherits or resolves a named theme for descendants.                              |

The root Store and `providerId` are immutable while mounted. Theme, boundary, inset, and enabled
dock positions are runtime policy and may change through their declared props.

More than one Provider may use a root Store, but each requires a distinct Provider ID. Provider IDs
do not namespace scopes. The same Panel scope cannot be active in two Providers over one root.

The exact Provider shape is:

```ts
type DashPanelBoundary = Element | RefObject<Element | null>

type DashPanelBoundaryInset =
  | number
  | readonly [vertical: number, horizontal: number]
  | readonly [top: number, horizontal: number, bottom: number]
  | readonly [top: number, right: number, bottom: number, left: number]

interface DashPanelProviderProps<TValues extends object, CustomTheme extends string = never> {
  children: ReactNode
  store: RootStore<TValues>
  providerId?: string
  boundary?: DashPanelBoundary | null
  boundaryInset?: DashPanelBoundaryInset
  dockPositions?: readonly DashPanelDockPosition[]
  portalContainer?: HTMLElement | null
  layerBase?: number
  theme?: PicodashThemeOption<CustomTheme>
  density?: PicodashDensity
}
```

- `providerId` defaults to `default`.
- `dockPositions` defaults to every canonical dock position. It declares an unordered maximum set;
  descendant Panels may narrow but not widen it, and each placement mode still filters positions it
  does not support.
- `portalContainer` and `layerBase` establish the shared overlay defaults as well as Panel portal
  ownership. Geometry continues to resolve independently through `boundary` and `boundaryInset`.
- Portal containers are HTML elements because they feed the shared React Aria portal context.
  `boundary` remains the broader `Element` type because geometry may legitimately resolve from SVG.
- The Provider owns no persistence configuration. Store construction supplies persistence policy,
  driver, and storage identity.
- The prototype props `panelBoundary`, `panelBoundaryInset`, `persistLayout`, and `storageKey` do not
  enter the target API.

## DashPanel public API

> Contract: Accepted
> Implementation: Planned

The exact launch prop surface is:

```ts
type DashPanelStyle = Omit<CSSProperties, 'inlineSize' | 'width'>

interface DashPanelProps<CustomTheme extends string = never> extends Omit<
  ComponentPropsWithoutRef<'aside'>,
  'children' | 'id' | 'style' | 'title'
> {
  id: string
  title: ReactNode
  children?: ReactNode
  style?: DashPanelStyle

  defaultVisible?: boolean
  defaultCollapsed?: boolean
  collapsible?: boolean
  showCloseButton?: boolean

  onVisibilityChange?: (visible: boolean) => void
  onCollapsedChange?: (collapsed: boolean) => void
  onRequestRemove?: (details: DashPanelRemoveRequest) => void

  defaultLayout?: DashPanelDefaultLayout
  placementOptions?: DashPanelPlacementOptions
  dockPositions?: readonly DashPanelDockPosition[]

  boundary?: DashPanelBoundary | null
  boundaryInset?: DashPanelBoundaryInset
  width?: CSSProperties['width']

  actionMenu?: false | readonly ReactElement[]
  theme?: PicodashThemeOption<CustomTheme>
  density?: PicodashDensity
  presentation?: DashPanelPresentation
}

interface DashPanelRemoveRequest {
  readonly scopeId: string
}

interface DashPanelDefaultLayout {
  readonly placement: DashPanelPlacement
  readonly preferredPosition?: Readonly<{ x: number; y: number }>
}

interface DashPanelPlacementOptions {
  readonly snapOffset?: number
  readonly snapProximity?: number
  readonly detachDistance?: number
}
```

All three placement-option values are non-negative finite CSS pixels. They default to
`snapOffset: 8`, `snapProximity: 16`, and `detachDistance: 40`. The prototype's
`detachThresholdMultiplier` is an internal algorithm detail and does not enter the target API.

The prop defaults are:

- `defaultVisible: true`;
- `defaultCollapsed: false`;
- `collapsible: true`;
- `showCloseButton: true`;
- a floating placement snapped to `top-right`;
- the Provider's complete currently enabled dock-position set; and
- inherited theme and density; and
- `{ kind: 'panel' }` presentation.

When `preferredPosition` is omitted, the first transition to free placement uses the Panel's current
contained rendered position. Declared defaults never become persisted overrides merely because a
Panel mounts.

`style.width` and `style.inlineSize` are reserved so they cannot compete with the `width` prop and
the public Panel-width token. Callers use `width` for one Panel or a `className`/stylesheet rule for
selector-based sizing. Other ordinary `aside` attributes and styles remain available. DashPanel
forwards an `HTMLAsideElement` ref.

The prototype props `store`, `contentMode`, `close`, `onClose`, controlled visibility/collapse, and
Motion-specific animation or drag props do not enter the target API. DashPanel exposes behavior
through its accepted props and controller rather than leaking its animation implementation.

A non-text `title` requires an explicit `aria-label`. `collapsible={false}` with
`defaultCollapsed={true}` is a developer contract error because it would create hidden content with
no reveal operation. Projecting an already collapsed Panel as a drawer or sheet temporarily renders
its body expanded without mutating collapse state; returning to `panel` restores the same collapse
state.

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

> Contract: Accepted
> Implementation: Partial
> Evidence: `packages/dashpanel/src/runtime/panel-runtime.test.ts` and
> `packages/dashpanel/tests/dashpanel.test.tsx` cover the private model plus React collapse
> controls, hidden/inert retained bodies, callback ordering, dynamic policy updates, and cleanup.
> Notes: React collapse is wired, but visibility, controllers, triggers, launchers, close/remove
> actions, focus, and browser evidence remain unimplemented.

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

> Contract: Accepted
> Implementation: Partial
> Evidence: `packages/dashpanel/src/placement/placement.test.ts` covers canonical placement
> combinations, defaults, option normalization, finite coordinates, hostile records, and recursive
> freezing. `packages/dashpanel/src/placement/dock-policy.test.ts` covers canonical policy
> resolution, provider inheritance, panel narrowing, disabled-position classification, and frozen
> detached outputs. The root type exports are checked by `dashpanel.types.test.ts` and the package
> artifact test.
> Notes: This cut establishes vocabulary, pure normalization, and pure dock-position policy only.
> Boundary math, docking, occupancy, allocation, pointer input, persistence, and runtime placement
> remain unimplemented.

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

type DashPanelPlacement =
  | {
      mode: 'floating'
      disposition: { kind: 'free' } | { kind: 'snapped'; position: DashPanelSnapPosition }
    }
  | {
      mode: 'fixed'
      disposition: { kind: 'docked'; position: DashPanelDockPosition }
    }
  | {
      mode: 'hybrid'
      disposition:
        | { kind: 'free' }
        | { kind: 'snapped'; position: 'top' | 'bottom' }
        | { kind: 'docked'; position: DashPanelDockPosition }
    }
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

The private dock-policy model resolves Provider and Panel position sets as frozen canonical-order
arrays. Provider omission enables all canonical positions; an explicit empty array disables every
dock target. Panel omission inherits the Provider maximum, while an explicit set may only narrow it;
widening or unknown positions throw synchronously. Placement classification reports `available` for
floating placements and permitted Hybrid snaps, or a frozen dormant result with status `dormant`,
reason `position_disabled`, and the disabled target for a Fixed or Hybrid dock placement. It does
not select fallbacks or materialize Store state.

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

Picodash defines a reviewed exception for integrated DashList rails. A corner rail's orientation
selects an effective edge, perpendicular rails may bound one another at their inner edges, and three
rail occupants on one edge receive the standard thirds accommodation. This coordination belongs to
the Picodash facade and does not make standalone DashPanel depend on DashList or change ordinary
non-rail allocation.

## Boundaries, insets, and portals

> Contract: Accepted
> Implementation: Partial
> Evidence: `packages/dashpanel/src/geometry/boundary.test.ts` covers direct HTML/SVG identity,
> Panel-over-Provider precedence, explicit viewport selection, unresolved-ref fallback, live refs,
> invalid values, and no-measurement behavior.
> Notes: This slice implements reference resolution only. Inset normalization, rectangle math,
> observers, and runtime/browser geometry remain unimplemented.

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

### Adaptive drawer and sheet presentation

> Contract: Accepted
> Implementation: Planned

DashPanel supplies three explicit presentations:

```ts
type DashPanelPresentation =
  | { kind: 'panel' }
  | { kind: 'drawer'; edge: 'left' | 'right' }
  | { kind: 'sheet'; edge: 'top' | 'bottom' }
```

`panel` is the ordinary non-modal movable and dockable presentation. The initial `drawer` and
`sheet` presentations are modal. A persistent non-modal drawer is an ordinary Fixed Panel docked to
`full-left` or `full-right`, not a fourth adaptive mode.

The host selects `presentation` from its own viewport, route, or application policy. DashPanel has
no product breakpoint and never changes presentation automatically. Drawer and sheet are transient
projections: they do not change the durable placement or preferred coordinates, and returning to
`panel` restores the same desktop layout input. DashList content continues to respond to its actual
container width independently.

While a drawer or sheet is active:

- movement, placement, collapse, and layout-reset actions are unavailable;
- the Panel uses modal-dialog semantics, a backdrop, focus containment, host scroll lock, and
  Escape/outside-interaction dismissal;
- dismissal restores focus through the ordinary connected-trigger chain;
- a visible Close control is mandatory, so `showCloseButton={false}` with either modal presentation
  is a developer contract error;
- reduced motion removes the slide transition without changing visibility or focus behavior; and
- portal ownership remains Provider-controlled while modal geometry uses the visual viewport rather
  than a persisted Panel boundary.

At most one sibling modal Panel may be visible in one Provider. A competing show command returns
`modal_occupied`. A prop-driven transition of an already visible Panel retains its previous
presentation and records the same structured diagnostic; it is not queued and does not retry until
the host changes the presentation input again. DashPanel never hides the existing modal silently.
Nested modal overlays inside the active Panel follow the shared UI layer and Escape-order contract.

Left and right drawers use the Panel's preferred width capped to the visual viewport. Top and bottom
sheets fill the available inline span and use intrinsic block size capped to the visual viewport.
Swipe-to-dismiss and drag-to-resize gestures are deferred until they have their own pointer,
accessibility, and conflict contract.

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

Mounting a visible Panel or applying a passive visibility change does not steal focus. An explicit
`DashPanelTrigger` or launcher activation follows its documented show-and-focus behavior. Hiding
restores focus first to the most recent connected trigger, then to the connected element focused
before Panel interaction, then to a Provider fallback. Closing a menu restores its trigger.
Reduced-motion preference removes non-essential movement while preserving state feedback.

## Close and removal

| Operation                 | Contract | Implementation | Behavior                                    |
| ------------------------- | -------- | -------------- | ------------------------------------------- |
| Hide/close                | Accepted | Prototype      | Changes transient visibility.               |
| Reopen                    | Accepted | Prototype      | Restores visibility without remounting.     |
| Request permanent removal | Accepted | Planned        | Notifies application; application unmounts. |
| Imperative deregistration | Rejected | Prototype      | Legacy behavior removed during conformance. |

The Close button calls the transient hide command; it never requests permanent removal.
`onRequestRemove` enables the confirmed `Remove panel…` action and receives only the resolved
`scopeId`. After confirmation, DashPanel calls the callback and the application decides whether to
unmount its JSX. Omitting the callback omits the permanent-removal action.

## Action menu

The built-in DashPanel menu contains only Panel-owned placement and layout-reset actions. Value
reset, group expansion, copy, import, export, and disclosure policy belong to DashList, Store, or
integrated Picodash composition.

| Configuration                      | Contract | Behavior                                              |
| ---------------------------------- | -------- | ----------------------------------------------------- |
| `actionMenu` omitted               | Accepted | Standard trigger with contributed then Panel actions. |
| `actionMenu={false}`               | Accepted | Hides the menu and every contributed action.          |
| `actionMenu={readonly elements[]}` | Accepted | Replaces all default and contributed menu items.      |
| Caller-replaced root trigger       | Deferred | Advanced surface only after a demonstrated need.      |

DashPanel exports the menu item, submenu, separator, and built-in placement/reset components needed
to compose the accepted custom-content path. They use public controller commands and must not
mutate Store or Provider internals.

The Panel-owned action exports are:

- `DashPanelActionItems`;
- `DashPanelPlacementSubmenu`;
- `DashPanelResetLayoutItem`; and
- `DashPanelRequestRemoveItem`.

Generic menu composition primitives are UI-owned explicit reexports; DashPanel owns the built-in
placement/reset items and every command they execute. Reexporting a primitive does not move its
accessibility or theme contract into DashPanel.

DashPanel also owns this narrow composition seam from `@picodash/dashpanel/integration`:

```ts
interface DashPanelDefaultActionItemsProps {
  scopeId: string
}

type DashPanelDefaultActionItems = ComponentType<DashPanelDefaultActionItemsProps>

interface DashPanelIntegrationProviderProps {
  children: ReactNode
  defaultActionItems?: DashPanelDefaultActionItems
}
```

`DashPanelIntegrationProvider` supplies at most one component type to descendant Panels. A Panel
uses the nearest integration Provider and renders that component before its placement and layout
actions only when `actionMenu` is omitted. Passing `false` hides the whole menu. Passing a custom
item array replaces both the contribution and Panel defaults; an empty array renders no trigger.
Callers may explicitly include exported action items in their replacement array.

The contributor receives only the resolved Panel `scopeId`. A component type rather than a render
callback preserves ordinary React hook and component-identity rules. Its output is declarative
ActionMenu-family content: it cannot replace the trigger, mutate private Panel runtime, add a
persistence path, or gain controller authority. Nearest-Provider replacement is the complete
resolution rule; there is no global registry, keyed plugin collection, or Provider prop that
applications merge.

The application-facing `actionMenu` prop remains the ordinary customization API. The integration
entry exists for a composing product such as Picodash and does not create a second application
extension system.

## Header composition

> Contract: Accepted
> Implementation: Planned

DashPanel uses the presentational `DashHeader` owned by `@picodash/ui` and explicitly reexports its
stable component and types. DashPanel supplies the grab surface, collapse control, title, action
menu, and close control through named slots and retains every associated behavior. `DashHeader`
does not initiate placement, toggle Panel state, or execute actions.

The shared API has `leading`, `title`, `actions`, and `trailing` slots in fixed DOM order and no
general `children` prop. It forwards its root ref so DashPanel can measure the header without
placing geometry or drag behavior in the shared package. These slots are an internal composition
boundary for DashPanel, not a public `headerSlots` override: Panel props create the default slot
nodes, while action-menu composition provides the accepted additive extension path. The complete
target is recorded in the [shared UI reference](ui.md#dashheader).

## Theme and CSS design tokens

> Contract: Accepted theme behavior and product-owned token inventory; implementation evidence
> pending for exhaustive shared-token consumption
>
> Implementation: Prototype

`@picodash/ui` owns `dark`, `light`, `system`, custom named-theme resolution, the accepted
`regular | compact` density axis, and all shared semantic tokens. `DashPanelProvider` establishes
the inherited theme and density; a Panel may override either. Theme and density are runtime
presentation and are never persisted by DashPanel. Portaled Panel-owned roots repeat both resolved
attributes; their descendants inherit.

Density changes shared geometry tokens without changing color roles, placement semantics, or
durable layout. Compact presentation keeps coarse-pointer hit targets at least 44 CSS pixels. An
application may persist its own preference in Store and pass it back as an ordinary prop.

Custom themes override public `--picodash-*` tokens under their named theme selector. Consumers must
not rely on `--_picodash-*` variables, which are package-private derived values.

DashPanel owns exactly one public product token:

| Variable                 | Purpose                          | Syntax                | Regular default                   |
| ------------------------ | -------------------------------- | --------------------- | --------------------------------- |
| `--picodash-panel-width` | Preferred intrinsic Panel width. | `<length-percentage>` | `min(20rem, calc(100dvw - 2rem))` |

The token and prop are two access paths to one preferred-width input:

1. `--picodash-panel-width` supplies the inherited host, Provider-container, or selector default;
2. `width` supplies a local inline token value for one Panel and takes precedence; and
3. the token's regular recipe supplies the fallback above when neither application path sets it.

The preferred width is presentation state, not durable layout. Boundary containment, dock
allocation, and the current presentation may cap or temporarily replace it; the resolved pixel
width is observed for geometry and never persisted. A content size change causes remeasurement and
containment without creating a layout override.

Valid intrinsic CSS width values are supported. For example, `width="fit-content"` or a selector
setting `--picodash-panel-width: fit-content` lets the browser derive width from arbitrary content,
subject to the effective boundary. DashPanel does not measure content and convert that result into
a stored numeric preference. This avoids making responsive children or DashList's container-based
layout into a circular persistence input.

`full-top` and `full-bottom` docks own the available inline span, so the preferred width is dormant
while either is active. Top/bottom sheets follow the same rule. Left/right drawers and ordinary
floating, snapped, corner, center, and side placements use the preferred width, capped to their
available geometry. Returning to a width-sensitive presentation restores the same preferred input.

No public token is added for header height, collapse offsets, docking allocation, drag opacity,
placement-preview paint, or runtime z-index. Those values are structural rules, placement
configuration, or package-private derived values rather than durable theming contracts.

The target Panel structure currently requires this candidate shared subset:

- `--picodash-color-{surface,surface-muted,text,text-muted,border}`;
- `--picodash-space-{1,2,3}`;
- `--picodash-font-size-xl`, `--picodash-font-weight-semibold`, and
  `--picodash-letter-spacing-normal`;
- `--picodash-control-height-md`, `--picodash-icon-{sm,md,lg}`, and
  `--picodash-radius-surface`;
- `--picodash-shadow-{md,elevated}` and `--picodash-blur-surface`; and
- `--picodash-duration-fast` and `--picodash-easing-out`.

That subset is candidate implementation evidence because DashHeader and the composed Button,
ActionMenu, Tooltip, and AlertDialog recipes belong to `@picodash/ui`. The implemented DashPanel
dependency table will take the
union of the Panel-owned structure and those accepted shared recipes, identify the consuming
component for each token, and link each shared meaning to the canonical
[shared UI inventory](ui.md#shared-public-token-inventory). This avoids treating the current copied
UI implementation as the target while still giving a DashPanel-only consumer a complete reference.

Before the shared-consumption conformance row becomes Verified, a check must prove that every
consumed public variable is documented and every documented variable is consumed or deliberately
inherited. DashList maintains its own complete dependency table by the same rule.

The prototype's copied shared recipe is removed during migration. DashPanel imports
`@picodash/ui/style.css`, defines only `--picodash-panel-*` public tokens in its own stylesheet, and
uses `--_picodash-*` for private Panel formulas.

## Triggers and launcher

> Contract: Accepted
> Implementation: Planned

```ts
interface DashPanelTriggerProps extends Omit<ButtonProps, 'onPress'> {
  panelId: string
  action?: 'show' | 'toggle'
}

interface DashPanelLauncherItem {
  panelId: string
  label: ReactNode
  disabled?: boolean
}

interface DashPanelLauncherProps extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  label: string
  items: readonly DashPanelLauncherItem[]
}
```

`DashPanelTrigger` defaults to `action="show"`. Showing a Panel makes it visible, activates its
Provider layer, and moves focus into its first appropriate focus target; an already visible Panel
is still activated and focused. `toggle` hides a visible Panel or performs the same show operation
for a hidden Panel.

`DashPanelLauncher` renders an application-declared group of Panel triggers. It does not discover
Panels through a registry, infer labels from mounted content, or acquire authority to mount missing
JSX. A launcher item for an unavailable Panel remains unavailable and does not create it.

Both components require the nearest DashPanel Provider. Their button behavior and public prop base
come from `@picodash/ui`, but DashPanel owns panel targeting, visibility, activation, and focus.

## Panel controller

> Contract: Accepted
> Implementation: Planned

```ts
type DashPanelCommandResult =
  | { readonly status: 'executed' }
  | {
      readonly status: 'not_executed'
      readonly reason: 'unavailable' | 'not_collapsible' | 'modal_occupied' | 'modal_presentation'
    }

type DashPanelLayoutCommandResult =
  | {
      readonly status: 'executed'
      readonly transaction: CoreTransactionResult | PersistentTransactionResult
    }
  | {
      readonly status: 'not_executed'
      readonly reason: 'unavailable' | 'dock_occupied' | 'position_disabled' | 'modal_presentation'
    }

interface DashPanelControllerCommands {
  show(): DashPanelCommandResult
  hide(): DashPanelCommandResult
  toggleVisibility(): DashPanelCommandResult
  activate(): DashPanelCommandResult
  expand(): DashPanelCommandResult
  collapse(): DashPanelCommandResult
  toggleCollapsed(): DashPanelCommandResult
  setPlacement(placement: DashPanelPlacement): DashPanelLayoutCommandResult
  resetLayout(): DashPanelLayoutCommandResult
}

type DashPanelController = DashPanelControllerCommands &
  (
    | {
        readonly availability: 'unavailable'
        readonly scopeId: string
      }
    | {
        readonly availability: 'available'
        readonly scopeId: string
        readonly visible: boolean
        readonly collapsed: boolean
        readonly collapsible: boolean
        readonly placement: DashPanelPlacement
        readonly presentation: DashPanelPresentation
      }
  )

function useDashPanel(panelId?: string): DashPanelController
```

With no argument, `useDashPanel()` targets the nearest Panel. With `panelId`, it targets that mounted
Panel in the nearest Provider. Calling the hook outside a DashPanel Provider, or omitting `panelId`
without a nearest Panel, is a lifecycle contract error. An explicit ID that is not currently mounted
returns an immutable unavailable controller rather than creating runtime state.

Every command rechecks current availability at execution time. Visibility, activation, and collapse
commands mutate transient Provider runtime. Placement and reset commands invoke Store and return its
structured persistent transaction result; `status: 'executed'` means the Store command ran, not that
the transaction necessarily committed. Structured Store rejection remains visible in `transaction`.
Ownership, lifecycle, and malformed-placement contract errors continue to throw.

DashPanel exposes no mutable Provider store, generic runtime selector, or `/advanced` entrypoint in
the initial contract. Applications select Store values through `@picodash/store/react`; DashPanel
does not create another equality or value-subscription API.

## Public package surfaces

| Surface                           | Contract | Implementation | Purpose                                             |
| --------------------------------- | -------- | -------------- | --------------------------------------------------- |
| `@picodash/dashpanel`             | Accepted | Prototype      | Provider, Panel, controller, actions, UI reexports. |
| `@picodash/dashpanel/integration` | Accepted | Planned        | Narrow default-action contribution seam.            |
| `@picodash/dashpanel/catalog`     | Accepted | Planned        | Static accepted-component metadata.                 |
| `@picodash/dashpanel/style.css`   | Accepted | Prototype      | UI foundation plus Panel structural styles.         |

There is no initial `@picodash/dashpanel/advanced` or `@picodash/dashpanel/ui` surface. Generic UI
primitives remain canonically imported from `@picodash/ui`; DashPanel explicitly reexports only the
accepted `DashHeader` and ActionMenu family needed for unchanged Panel composition.

## Implementation evidence to complete

No unresolved DashPanel contract question blocks implementation. Conformance still must produce:

1. the exhaustive shared-token consumption table after shared components are implemented;
2. cohesive regular, compact, intrinsic-width, dock-allocation, drawer, and sheet visual evidence;
3. package and type evidence for every accepted public surface; and
4. proof that private geometry selectors and formulas have not become customization promises.

These are implementation and verification obligations. They do not reopen Store ownership,
declarative lifecycle, placement semantics, adaptive presentation, persistence, accessibility, or
action ownership without an explicit contract revision.

## Related documents

- [Shared UI target reference](ui.md)
- [DashPanel value proposition](../product/value-propositions.md#dashpanel)
- [Store target reference](store.md)
- [Store decisions](store-contract-decisions.md)
- [Component catalog target reference](catalog.md)
- [Contract conformance](contract-conformance.md)
- [Roadmap](../ROADMAP.md)
