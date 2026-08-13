# Component catalog target reference

The Picodash component catalog is static, JSON-compatible metadata that helps coding agents and
documentation tools find the accepted public component for a task. It describes public exports; it
does not register components or participate in application runtime.

## Status

> Contract: Accepted
> Implementation: Planned
> Evidence: The schema, ownership, publication paths, exclusions, and artifact checks are accepted.

## Audience and purpose

The catalog answers a deliberately small set of questions for a coding agent:

- Which package owns this component?
- Which public entrypoint and export name should be imported?
- What kind of component is it and what can it represent?
- Does it bind a field, and which broad value kinds can it present?
- Where may it be composed?
- How is its accessible name supplied?
- Which reference page owns the complete behavioral contract?

TypeScript declarations remain the authority for exact props and generic inference. Product
references remain the authority for behavior. The catalog must not copy either source into a
second, weaker schema.

## Schema

Every published catalog conforms to this versioned structural schema:

```ts
interface PicodashComponentCatalog {
  readonly schemaVersion: 1
  readonly entries: readonly PicodashCatalogEntry[]
  readonly reexports: readonly PicodashCatalogReexport[]
}

interface PicodashCatalogEntry {
  readonly id: string
  readonly owner: '@picodash/dashpanel' | '@picodash/dashlist' | '@picodash/picodash'
  readonly entrypoint: string
  readonly exportName: string
  readonly kind:
    'provider' | 'panel' | 'list' | 'group' | 'dashlet' | 'anatomy' | 'action-composition'
  readonly summary: string
  readonly capabilities: readonly string[]
  readonly field: {
    readonly cardinality: 'none' | 'optional' | 'one' | 'many'
    readonly valueKinds: readonly ('boolean' | 'number' | 'string' | 'string-or-number' | 'json')[]
  }
  readonly composition: {
    readonly allowedParents: readonly string[]
    readonly recommendedParents: readonly string[]
  }
  readonly accessibleName: 'visible-label' | 'required' | 'inherited' | 'none'
  readonly reference: string
}

interface PicodashCatalogReexport {
  readonly entryId: string
  readonly entrypoint: string
  readonly exportName: string
}
```

The interfaces describe a structural data contract, not a new runtime foundation package. Each
catalog entrypoint publishes its own deeply frozen object and declarations. A consumer may use the
structural type from the catalog it imports; the independently useful packages do not depend on the
Picodash facade merely to describe their exports.

## Entry ownership

- DashPanel publishes one entry for every Accepted public React component it owns.
- DashList publishes one entry for every Accepted public React component it owns, including each
  stable ready-made Dashlet in the inventory defined by the [DashList reference](dashlist.md#stable-ready-made-inventory).
- Picodash publishes its `PicodashProvider` entry, combines the exact foundation entry objects, and
  records facade import paths in `reexports`.
- A facade reexport never becomes a copied entry or changes the entry's `owner`.
- Draft or experimental Dashlet anatomy helpers are excluded until their contracts become Accepted.
- Experimental chart exports (`ChartDashlet` and `SparklineDashlet`) are excluded from the root
  inventory and catalog. They remain isolated subpath capabilities until their pre-alpha contract
  and browser evidence are complete.
- `@picodash/ui` has no initial catalog. Product-neutral primitives are documented through their
  public declarations and reference rather than marketed as Picodash composition choices.

Third-party component packages own and version their own metadata. The closed `owner` union above
describes the first-party catalog schema; it is not a registry or extension protocol for arbitrary
packages.

## Field and composition summaries

`field` is coarse discovery metadata only:

- `none` means the component has no Nexus field binding;
- `optional` means a field binding is supported but not required;
- `one` means one compatible field is required; and
- `many` means the component may bind several fields as one composition.

`valueKinds` is empty when cardinality is `none`. It never replaces the component's TypeScript field
type. `composition.allowedParents` records legal public composition boundaries. Recommended parents
identify the ordinary path without claiming that every allowed advanced composition is preferable.

Capabilities use stable, documented terms such as `dock`, `reorder`, `collapse`, `edit`, `read`, or
`compose`. They are descriptive tags, not feature flags, permissions, selectors, or a compatibility
solver.

## Excluded metadata

The initial catalog contains no:

- React components, callbacks, loaders, factories, or lazy imports;
- runtime registration or plugin API;
- complete prop schema, parser, validator, or code generator;
- token inventory, variant-helper output, or CSS recipe identifiers;
- prototype `importantProps` or `variants` summaries;
- Maps, Sets, class instances, or other non-JSON values; or
- catalog filtering/query API.

Agents use ordinary array operations or their own index. Keeping the catalog inert makes it safe to
inspect in build tools and avoids creating a second component authority.

## Publication

The accepted catalog entrypoints are:

- `@picodash/dashpanel/catalog`;
- `@picodash/dashlist/catalog`; and
- `@picodash/picodash/catalog`.

Each entrypoint exports the same predictable names:

```ts
export const catalog: PicodashComponentCatalog
export type { PicodashCatalogEntry, PicodashCatalogReexport, PicodashComponentCatalog }
```

There is no default export. The three type declarations are structurally identical, so tooling may
consume any catalog independently without introducing a dependency between the standalone products
or on the facade.

Each entrypoint has no browser, React-rendering, Nexus-runtime, or stylesheet side effect. The
published object is deeply frozen and JSON-serializable. `schemaVersion` changes only when a
consumer must interpret the data differently; adding an entry under the same schema does not
change it.

## Conformance

Artifact checks verify:

1. every entry ID is unique across the combined first-party catalog;
2. every owner entry names a real export from the stated public entrypoint;
3. every parent ID and reference resolves;
4. every reexport points to an existing owner entry and real facade export;
5. facade aggregation retains the exact foundation entry objects;
6. Draft and private components do not appear; and
7. the complete published value is deeply frozen and JSON-serializable.

Catalog checks do not repeat component behavior or prop-type tests.

## Related documents

- [DashPanel target reference](dashpanel.md)
- [DashList target reference](dashlist.md)
- [Picodash target reference](picodash.md)
- [Contract conformance](contract-conformance.md)
