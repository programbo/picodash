# DashList target reference

DashList is a standalone React composition system for ordered, groupable collections of controls,
readouts, visualizations, previews, and actions. This page describes the aspirational
`@picodash/dashlist` contract.

## Status

> Contract: Draft
> Implementation: Prototype
> Evidence: Existing anatomy and Store tests are reference material only.
> Notes: Store identity, scope, binding, order, and collapse invariants are accepted. Dashlet
> anatomy and product ergonomics require a focused contract review.

## Package purpose

DashList owns List, group, item, binding, and reorder composition inside an application-owned
layout. It does not require DashPanel or `PicodashProvider`.

## Standalone composition

```tsx
const store = createPicodashStore({
  storeId: 'settings',
  schemaVersion: 1,
  valueOwner: 'store',
  fields: {
    theme: { defaultValue: 'system' },
    density: { defaultValue: 1 },
  },
})

function Settings() {
  return (
    <PicodashList id="settings" store={store}>
      <SelectDashlet id="theme" field={store.fields.theme} />
      <SliderDashlet id="density" field={store.fields.density} />
    </PicodashList>
  )
}
```

| API/component       | Contract | Implementation | Notes                                         |
| ------------------- | -------- | -------------- | --------------------------------------------- |
| `PicodashList`      | Draft    | Prototype      | Public naming needs final product review.     |
| root `store` + `id` | Accepted | Planned        | Resolves an explicit scope.                   |
| scoped `store`      | Accepted | Planned        | `id` may be omitted or must agree.            |
| `children`          | Accepted | Prototype      | Explicit typed JSX; no schema-generated List. |

## Context composition

```tsx
<PicodashPanel id="settings">
  <PicodashList />
</PicodashPanel>
```

An id-less primary List inherits the nearest scope. Only one active DashList is permitted in that
scope.

```tsx
<PicodashPanel id="settings">
  <PicodashList id="basic" />
  <PicodashList id="advanced" />
</PicodashPanel>
```

Explicit IDs resolve child scopes and register active declarative relationships from `settings`.
DashList supplies its scoped Store context to descendants. A Provider boundary resets ancestry.

> Contract: Accepted
> Implementation: Planned

## Identity

| Identity               | Contract | Implementation | Rule                                            |
| ---------------------- | -------- | -------------- | ----------------------------------------------- |
| List `id`              | Accepted | Planned        | Scope ID; immutable while mounted.              |
| Item `id`              | Accepted | Partial        | Explicit for every durable List node.           |
| Group `id`             | Accepted | Partial        | Shares the scope's node-ID namespace.           |
| Binding alias          | Accepted | Planned        | Defaults to field key; explicit for duplicates. |
| React key or `useId()` | Rejected | Prototype      | Not durable Store identity.                     |

IDs are opaque and exact. Renaming an item/group changes its durable metadata identity and requires
an explicit migration when old preferences matter.

## Dashlet model

A Dashlet is one composable List item. It may contain a control, readout, visualization, preview,
action, or compound composition. A writable control is one Dashlet type, not the definition of every
Dashlet.

> Contract: Draft
> Implementation: Prototype

The target retains explicit JSX and typed field handles. It does not generate complete UI from a
field schema. Final review must define:

- required Dashlet anatomy and semantic slots;
- label, description, value, status, action, and error placement;
- single-field versus compound Dashlet conventions;
- read-only and action-only Dashlets;
- how custom Dashlets consume package UI primitives;
- which ready-made Dashlets belong to DashList versus Picodash.

## Field bindings

```tsx
<CustomDashlet id="exposure">
  <FieldBinding field={store.fields.exposure} alias="slider" />
</CustomDashlet>
```

The exact binding component API is draft. Accepted behavior is:

- handles are nominally owned by the root Store;
- canonical values are root-global;
- drafts, touched state, input issues, and stale conflicts are binding-local;
- the same root field may appear in several items/scopes;
- dirty drafts survive canonical updates but become stale;
- binding state clears on final unmount.

| Binding capability               | Contract | Implementation | Notes                                      |
| -------------------------------- | -------- | -------------- | ------------------------------------------ |
| Typed canonical field handle     | Accepted | Prototype      | Must reject cross-root handles.            |
| Draft and parse feedback         | Accepted | Prototype      | Moves to binding identity.                 |
| Stale-draft conflict             | Accepted | Planned        | Requires discard or confirmed overwrite.   |
| Compound multi-field transaction | Accepted | Prototype      | Whole candidate validates atomically.      |
| Cross-field issue presentation   | Draft    | Prototype      | Final Dashlet error anatomy is unresolved. |

## Groups and containment

```tsx
<PicodashGroup id="rendering" title="Rendering">
  <SliderDashlet id="exposure" field={store.fields.exposure} />
  <SelectDashlet id="quality" field={store.fields.quality} />
</PicodashGroup>
```

| Group behavior             | Contract | Implementation | Notes                                     |
| -------------------------- | -------- | -------------- | ----------------------------------------- |
| Declarative containment    | Accepted | Prototype      | Persistence never owns parent membership. |
| Collapsible group          | Accepted | Prototype      | User state is a durable override.         |
| Nested groups              | Draft    | Prototype      | Depth and interaction rules need review.  |
| Group-level actions/status | Draft    | Prototype      | Anatomy unresolved.                       |
| Conditional children       | Accepted | Prototype      | Absence never proves obsolescence.        |

Items and groups share a node namespace within the List scope. Reparenting releases the previous
registration before mounting under a new container.

## Ordering

> Contract: Accepted
> Implementation: Prototype

- Before customization, siblings follow declaration order.
- A completed user reorder creates a per-container durable override.
- New nodes append to a customized container in declaration order.
- Returning dormant nodes recover their prior position where possible.
- Reset removes the override and returns to current declaration order.
- Containment is never persisted as order metadata.
- Cross-container dragging is not supported by the initial contract.
- Cancelled pointer or keyboard reorder writes nothing.

### Interaction parity

> Contract: Draft
> Implementation: Partial

Pointer and keyboard reordering must produce the same valid committed orders and respect the same
container constraints. The focused contract review still needs to define keyboard commands,
announcements, focus restoration, drag handles, and mobile affordances.

## Collapse overrides

> Contract: Accepted
> Implementation: Prototype

Declared collapse state is the default. User changes create durable overrides. Reset deletes
overrides so updated declared defaults apply. Metadata for dormant nodes remains until explicit
pruning or scope destruction.

## Pruning

| API/capability              | Contract | Implementation | Notes                                           |
| --------------------------- | -------- | -------------- | ----------------------------------------------- |
| Candidate prune plan        | Accepted | Planned        | Lists dormant IDs without classifying them.     |
| Explicit remove/keep IDs    | Accepted | Planned        | Required when no complete inventory exists.     |
| `knownNodeIds` inventory    | Accepted | Planned        | Application asserts authoritative completeness. |
| Automatic unmounted pruning | Rejected | —              | Conditional rendering makes it unsafe.          |

Pruning affects only List metadata, never canonical values.

## Reset behavior

| Action                  | Contract | Implementation | Behavior                                     |
| ----------------------- | -------- | -------------- | -------------------------------------------- |
| Discard one draft       | Accepted | Prototype      | Leaves canonical value unchanged.            |
| Reset registered values | Accepted | Planned        | Active fields; atomic; optional descendants. |
| Reset List metadata     | Accepted | Planned        | Removes order/collapse overrides.            |
| Destroy scope           | Accepted | Planned        | Erases scope state but not identity.         |

The built-in “Reset values” action combines canonical reset with discarding drafts in targeted
bindings. Other scopes' drafts remain and become stale if they share reset fields.

## Documents

> Contract: Accepted through Store
> Implementation: Prototype

DashList delegates import/export validation, field disclosure, sensitive promotion, and atomic value
writes to Store. A scoped document may include:

- the List scope's durable order/collapse overrides;
- optionally active descendant scopes;
- deduplicated canonical values for actively registered fields, subject to export policy.

It never contains drafts, focus/hover state, active relationships, or inferred dormant field
membership.

The DashList product contract still needs to decide which document actions are built into List UI
and which are only exposed through Picodash action composition.

## Styling and theming

> Contract: Draft
> Implementation: Prototype

DashList uses shared semantic theme tokens and accessible package-owned UI primitives. Final review
must define:

- required structural stylesheet and public token set;
- default density and responsive layout behavior;
- row/grid alignment for simple and compound Dashlets;
- custom visualization token guidance;
- whether standalone DashList needs a public theme boundary or inherits host tokens only.

## Accessibility target

> Contract: Draft
> Implementation: Prototype

DashList targets WCAG 2.2 AA behavior for labeling, description/error relationships, group
semantics, keyboard reorder, announcements, focus retention, collapsed content, and control touch
targets. Exact patterns must be accepted before implementation status advances.

## Public package surfaces

| Surface                        | Contract | Implementation | Notes                                 |
| ------------------------------ | -------- | -------------- | ------------------------------------- |
| `@picodash/dashlist`           | Accepted | Prototype      | List, groups, and common composition. |
| `@picodash/dashlist/dashlet`   | Draft    | Prototype      | Custom Dashlet anatomy.               |
| `@picodash/dashlist/ui`        | Draft    | Prototype      | Accessible low-level primitives.      |
| `@picodash/dashlist/style.css` | Accepted | Prototype      | Complete structural styles.           |

## Open contract questions

DashList is not implementation-ready until a focused review resolves:

1. Final product/component naming (`DashList`, `PicodashList`, and group/item names).
2. Required Dashlet anatomy and extension points.
3. Built-in Dashlet catalog ownership.
4. Group nesting depth and group-level actions.
5. Keyboard reorder commands, announcements, and focus rules.
6. Responsive row layout and compound Dashlet alignment.
7. Cross-field validation issue placement.
8. Which reset/document actions appear in standalone DashList UI.
9. Standalone theme boundary and shipped semantic styling.
10. Empty, loading, disabled, read-only, and error-state contracts.

## Related documents

- [DashList value proposition](../product/value-propositions.md#dashlist)
- [Store target reference](store.md)
- [Store decisions](store-contract-decisions.md)
- [Roadmap](../ROADMAP.md)
