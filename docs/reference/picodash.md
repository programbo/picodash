# Picodash target reference

Picodash is the integrated React control and monitoring product built from Store, DashPanel, and
DashList. This page describes the aspirational `@picodash/picodash` facade and integration contract.

## Status

> Contract: Draft
> Implementation: Prototype
> Evidence: Integrated prototype behavior has not been reconciled with the foundational target
> references.
> Notes: Picodash implementation follows stable Store, DashPanel, and DashList contracts.

## Product purpose

Picodash gives an existing React application one integrated way to render Panels containing
ordered, grouped Dashlets backed by typed application values. It is a facade and composition system,
not an application framework or monolithic Dashboard component.

Applications continue to own routing, data transport, authentication, authorization, exposure
policy, and the JSX that decides which Panels and Dashlets exist.

## Target composition

```tsx
const store = createPicodashStore({
  storeId: 'application-controls',
  schemaVersion: 1,
  valueOwner: 'store',
  fields: {
    theme: { defaultValue: 'system' },
    density: { defaultValue: 1 },
  },
})

function ApplicationControls() {
  return (
    <PicodashProvider store={store}>
      <PicodashPanel id="settings" title="Settings">
        <PicodashList>
          <SelectDashlet id="theme" field={store.fields.theme} />
          <SliderDashlet id="density" field={store.fields.density} />
        </PicodashList>
      </PicodashPanel>
    </PicodashProvider>
  )
}
```

The id-less primary List inherits `settings`; Panel and List share one scope and may contribute one
entity of each kind.

## Explicit child scopes

```tsx
<PicodashPanel id="settings">
  <PicodashList id="basic">...</PicodashList>
  <PicodashList id="advanced">...</PicodashList>
</PicodashPanel>
```

`basic` and `advanced` are root-global scope IDs connected to `settings` through active declarative
edges. The strings do not encode ancestry. Aggregate Panel actions may explicitly include active
descendants.

> Contract: Accepted through Store
> Implementation: Planned

## Integration ownership

| Concern                                       | Owner                              |
| --------------------------------------------- | ---------------------------------- |
| Canonical fields, values, transactions        | Store                              |
| Durable scope metadata and relationships      | Store                              |
| Panel hosting, placement, portals, visibility | DashPanel                          |
| Items, groups, bindings, order, collapse      | DashList                           |
| Semantic tokens and theme recipes             | Theme package plus host boundaries |
| Integrated defaults and ready-made Dashlets   | Picodash                           |
| Routing, data transport, authorization        | Application                        |

Picodash must not solve foundation defects with facade-only state or compatibility shims.

## Aggregate actions

> Contract: Draft
> Implementation: Prototype

Integrated Panel actions may request explicit descendant aggregation for operations such as reset,
export, and metadata inspection. Accepted Store constraints still apply:

- descendant traversal uses only active relationships;
- root fields are deduplicated;
- shared fields have global canonical consequences;
- layout, ordering, focus, and drag remain local to their owning scope/host;
- dormant descendants are not inferred;
- sensitive export promotion requires an explicit plan and confirmation.

The final Picodash contract must define which aggregate actions ship by default and how the UI
summarizes affected scopes and shared fields.

## Ready-made Dashlets

> Contract: Draft
> Implementation: Prototype

Picodash may provide Store-bound ready-made Dashlets for common values and application controls.
They should use DashList anatomy and public Store handles rather than privileged integration APIs.

The catalog still needs decisions about:

- the minimum built-in control/readout set;
- naming across raw primitives, themed controls, and Store-bound Dashlets;
- compound and visualization Dashlets;
- async application actions and loading/error presentation;
- catalog metadata and agent discovery;
- which components belong in DashList versus only in the integrated facade.

## Theme integration

> Contract: Draft
> Implementation: Prototype

Picodash should ship complete structural styles and supported semantic theme recipes for integrated
Panels, Lists, Dashlets, and overlays. Host applications may define named custom themes through
semantic token overrides.

The final contract must avoid making demo-only recipes public defaults and must ensure portaled
content receives the same resolved theme as its owning Panel.

## Documents

> Contract: Accepted through Store; integrated UI Draft
> Implementation: Prototype

Store owns document schema, policy, validation, mapping, and atomic commit. Picodash composes
document actions into Panel/List UI and may provide user-facing preview and confirmation dialogs.

The integrated UI must:

- show target scopes and shared-field effects;
- mask values according to target disclosure policy;
- distinguish redacted, omitted, unchanged, and included entries;
- require confirmation for permitted sensitive promotion;
- show foreign Store/schema warnings;
- never imply global atomic observation across an external host store and Picodash metadata.

## Package facade

| Surface                        | Contract | Implementation | Notes                                        |
| ------------------------------ | -------- | -------------- | -------------------------------------------- |
| `@picodash/picodash`           | Accepted | Prototype      | Common integrated exports.                   |
| `@picodash/picodash/advanced`  | Draft    | Prototype      | Runtime inspection and advanced composition. |
| `@picodash/picodash/dashlet`   | Draft    | Prototype      | Structural and ready-made Dashlet surface.   |
| `@picodash/picodash/ui`        | Draft    | Prototype      | Accessible public UI primitives.             |
| `@picodash/picodash/catalog`   | Draft    | Prototype      | Agent/developer discovery metadata.          |
| `@picodash/picodash/style.css` | Accepted | Prototype      | Integrated structural/theme styles.          |

The facade reexports stable foundation APIs for convenience but does not fork their types or
behavior.

## Integration verification

Picodash tests prove cross-product seams rather than repeating foundation matrices. Priority
integration evidence includes:

- Provider root context reaching Panel and List;
- same-scope Panel/List composition;
- explicit child-scope relationships;
- aggregate actions across active descendants;
- shared field effects across Lists;
- portal/theme/focus behavior with Dashlets;
- package exports and one complete public example.

## Open contract questions

Picodash is intentionally not implementation-ready until the foundational products stabilize. Its
focused contract review must resolve:

1. Exact common facade exports and naming.
2. Default integrated Panel action menu.
3. Built-in Dashlet catalog and ownership.
4. Aggregate reset/export UX and impact summaries.
5. Integrated theme recipes and customization surface.
6. Catalog metadata for coding-agent discovery.
7. Whether any convenience composition beyond explicit JSX is justified.
8. Public examples and supported host recipes for the first stable release.

## Related documents

- [Picodash value proposition](../product/value-propositions.md#picodash)
- [Store target reference](store.md)
- [DashPanel target reference](dashpanel.md)
- [DashList target reference](dashlist.md)
- [Roadmap](../ROADMAP.md)
