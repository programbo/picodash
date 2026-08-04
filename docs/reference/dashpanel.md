# DashPanel target reference

DashPanel is a standalone React panel shell for movable, dockable, dismissible application UI. This
page describes the aspirational `@picodash/dashpanel` contract. The prototype is evidence, not the
source of truth.

## Status

> Contract: Draft
> Implementation: Prototype
> Evidence: Existing geometry and Contract Lab behavior require reconciliation.
> Notes: Store ownership and declarative lifecycle are accepted. Detailed Panel API composition
> needs a focused contract review before implementation begins.

## Package purpose

DashPanel renders arbitrary React content in a host-coordinated Panel without requiring DashList.
It owns Panel composition, placement, portals, themes, accessible actions, and transient host
runtime. Store owns durable layout overrides and scope identity.

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
    <PicodashProvider store={store}>
      <PicodashPanel id="inspector" title="Inspector">
        <Inspector />
      </PicodashPanel>
    </PicodashProvider>
  )
}
```

| API                | Contract | Implementation | Notes                                              |
| ------------------ | -------- | -------------- | -------------------------------------------------- |
| `PicodashProvider` | Accepted | Prototype      | Must require an explicit root Store.               |
| `PicodashPanel`    | Draft    | Prototype      | Component name retained pending API review.        |
| `id`               | Accepted | Prototype      | Resolves the Panel scope; immutable while mounted. |
| `title`            | Draft    | Prototype      | Accessible naming behavior needs final review.     |
| `children`         | Accepted | Prototype      | Arbitrary React content.                           |

DashPanel does not accept an independent Store. Its Provider supplies a root Store, and the Panel
supplies its scoped view to descendants.

## Provider

| Provider capability       | Contract | Implementation | Notes                                               |
| ------------------------- | -------- | -------------- | --------------------------------------------------- |
| Required root `store`     | Accepted | Planned        | Scoped Stores are rejected.                         |
| `providerId="default"`    | Accepted | Planned        | Duplicate IDs conflict within one root.             |
| Hard Store/scope boundary | Accepted | Planned        | No child relationship crosses the Provider.         |
| Shared Panel boundary     | Draft    | Prototype      | Current `panelBoundary` behavior is reference.      |
| Shared boundary inset     | Draft    | Prototype      | Current `panelBoundaryInset` behavior is reference. |
| Portal ownership          | Draft    | Prototype      | Must preserve accessible overlay and theme context. |
| Theme                     | Draft    | Prototype      | Built-in/custom theme contract needs review.        |

Provider root Store and Provider ID are immutable while mounted. Theme and geometry policy may
change through their declared contracts.

## Scope and lifecycle

> Contract: Accepted
> Implementation: Planned

- One active DashPanel is permitted per scope.
- A Panel and one primary DashList may share the scope.
- A Panel that resolves a different scope from its nearest scoped context registers a declarative
  parent-child edge.
- Store entity and relationship leases follow committed React lifecycle.
- CSS hiding does not release them; effect deactivation and unmount do.
- Permanent removal is application-owned unmounting.
- Imperative `deregister` close behavior is retired.

## Placement model

The prototype distinguishes placement mode from current disposition. This remains the preferred
target unless contract review exposes a simpler complete model.

| Placement capability             | Contract | Implementation | Notes                                           |
| -------------------------------- | -------- | -------------- | ----------------------------------------------- |
| Floating mode                    | Draft    | Prototype      | Free movement and offset edge snaps.            |
| Fixed mode                       | Draft    | Prototype      | Corner, middle-side, and full-side docks.       |
| Hybrid mode                      | Draft    | Prototype      | Free plus selected snaps/docks.                 |
| Free disposition                 | Draft    | Prototype      | Contained floating geometry.                    |
| Snapped disposition              | Draft    | Prototype      | Offset and floating-like.                       |
| Docked disposition               | Draft    | Prototype      | Flush and fixed-like.                           |
| Pointer/keyboard movement parity | Draft    | Partial        | Required accessibility outcome, gaps unaudited. |
| Independent intent proxy         | Draft    | Prototype      | Hybrid intent commits only on release.          |

### Boundaries and insets

> Contract: Draft
> Implementation: Prototype

Boundary resolution currently follows Panel override, Provider default, then viewport. Explicit
`null` selects the viewport; an unresolved ref falls through.

Inset resolution currently follows Panel override, Provider default, then zero. Insets constrain
free placement and define the flush docking boundary. Snaps apply their separate offset after the
inset is resolved. Insets are runtime policy and are not persisted.

These rules remain prototype reference until the DashPanel contract session confirms naming,
responsive behavior, and boundary-change recovery.

## Durable layout

> Contract: Accepted
> Implementation: Prototype

Store persists only a settled layout override:

- canonical placement mode/disposition;
- compatible boundary-relative coordinates;
- no visibility, focus, activation, z-order, drag preview, boundary object, or inset policy.

A completed move, snap, or dock creates the override. Cancellation writes nothing.
`resetDashPanelLayout()` removes it so the current declared default applies. Remounting the scope
under a different Provider reuses compatible placement and defaults incompatible records.

## Transient Provider runtime

| Runtime fact           | Contract | Implementation | Owner                     |
| ---------------------- | -------- | -------------- | ------------------------- |
| Visibility             | Accepted | Prototype      | Provider runtime          |
| Activation and z-order | Accepted | Prototype      | Provider runtime          |
| Portal and boundary    | Accepted | Prototype      | Provider runtime          |
| Drag preview/intent    | Accepted | Prototype      | Component-local runtime   |
| Hover and menu state   | Accepted | Prototype      | Component/overlay runtime |

Hidden Panels remain declaratively mounted and retain Store leases. Reopen controls are
application- or Provider-owned and remain available when the Panel portal is absent.

## Close and removal

| Operation                 | Contract | Implementation | Behavior                                      |
| ------------------------- | -------- | -------------- | --------------------------------------------- |
| Hide/close                | Accepted | Prototype      | Changes transient visibility.                 |
| Reopen                    | Accepted | Prototype      | Restores visibility without remounting.       |
| Request permanent removal | Accepted | Planned        | Notifies application; application unmounts.   |
| Imperative deregistration | Rejected | Prototype      | Legacy behavior to remove before conformance. |

Exact callback names for permanent removal remain draft.

## Action menu

The prototype's composable action menu is useful reference:

| API/capability                      | Contract | Implementation | Notes                                       |
| ----------------------------------- | -------- | -------------- | ------------------------------------------- |
| Default action menu                 | Draft    | Prototype      | Final default contents need product review. |
| Hide the menu                       | Draft    | Prototype      | Current `actionMenu={false}` pattern.       |
| Replace/extend root menu            | Draft    | Prototype      | Preserve accessible nested-menu behavior.   |
| Dangerous-operation confirmation    | Accepted | Prototype      | Used by sensitive export/removal actions.   |
| Placement/reset/import/export items | Draft    | Prototype      | Ownership depends on final product APIs.    |

Built-in actions must use public Store commands and Provider runtime. They must not mutate Store
internals or bypass export confirmation plans.

## Theme and portals

> Contract: Draft
> Implementation: Prototype

Provider establishes the default semantic theme. A Panel may override it. Portaled Panel-owned
siblings and overlay roots carry the resolved theme at their portal root; descendants inherit
semantic tokens. Demo-only recipes are not package defaults.

The final contract still needs to confirm:

- shipped theme names and system behavior;
- custom-theme typing;
- which detached overlay roots DashPanel owns;
- whether theme belongs exclusively to Provider/Panel or also needs a Store-independent wrapper.

## Accessibility target

> Contract: Draft
> Implementation: Prototype

DashPanel targets WCAG 2.2 AA behavior. The accepted product outcome requires:

- a stable accessible Panel name;
- keyboard access to actions and movement alternatives;
- predictable focus when opening, hiding, closing menus, and reopening;
- pointer and keyboard parity where placement actions are available;
- overlays that preserve focus containment/restoration and portal stacking;
- motion behavior compatible with reduced-motion preference.

Exact keyboard placement commands and close-focus destinations remain open contract details.

## React runtime hooks

The Provider requires APIs for visibility, activation, host inspection, and Panel-scoped access.
Current prototype hooks are evidence, but their names and state shapes are not accepted merely
because they exist.

| Hook purpose                 | Contract | Implementation | Notes                                 |
| ---------------------------- | -------- | -------------- | ------------------------------------- |
| Control one mounted Panel    | Accepted | Prototype      | Visibility/activation only.           |
| Select Provider runtime      | Draft    | Prototype      | Must not expose mutable internals.    |
| Select nearest Panel runtime | Draft    | Prototype      | Separate from scoped Store selection. |
| Access nearest scoped Store  | Accepted | Planned        | Provided by `@picodash/store/react`.  |

## Open contract questions

DashPanel is not implementation-ready until a focused review resolves:

1. Final public component and prop naming.
2. Required versus optional Panel chrome and anatomy.
3. Resize behavior, if any, and its persistence contract.
4. Keyboard placement and focus-restoration rules.
5. Responsive/mobile fallback for floating, snapped, and docked layouts.
6. Default action-menu contents and which actions belong to DashPanel versus Picodash.
7. Final theme and custom-theme surface.
8. Controlled versus uncontrolled visibility API.

## Related documents

- [DashPanel value proposition](../product/value-propositions.md#dashpanel)
- [Store target reference](store.md)
- [Store decisions](store-contract-decisions.md)
- [Roadmap](../ROADMAP.md)
