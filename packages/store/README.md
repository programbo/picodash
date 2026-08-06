# `@picodash/store`

Store is a framework-independent typed state foundation for configurable React interfaces. It gives
applications one synchronous, validated value authority plus durable DashPanel and DashList metadata
without requiring the application to replace its preferred state library.

## Status

> Contract: Accepted target API
>
> Implementation: Partial overall; Store alpha verified for consumer dogfooding

Reconciling implementation evidence is tracked in [Store Reconciliation Ledger](./RECONCILIATION.md); these entries describe current branch transitions only and do not assign contract status.

The Store alpha release gate is verified through the public root, React, and integration entries.
Core/scoped values, durable metadata, synchronous Store-owned persistence, the manual external
adapter, explicit React selectors, diagnostics, and Provider/entity/relationship leases are ready
for DashPanel and DashList dogfooding. Binding interaction state, contextual hooks, documents,
migrations, advanced recovery, external-owned persistence, and runtime inspection remain beta work.

## Target package surfaces

- `@picodash/store`: root/scoped Stores, fields, transactions, persistence, documents, diagnostics,
  and the manual external-value adapter contract.
- `@picodash/store/react`: explicit Store selector subscriptions and `shallowEqual`.
- `@picodash/store/integration`: supported advanced context and declarative lease protocol for
  DashPanel, DashList, and other declarative product integrations.

The root entry is framework-independent and must load without React. React is required only for the
React-facing entries.

The React entry currently exports `usePicodashStoreSelector(store, selector, equalityFn?)` for an
explicit root or scoped Store, plus `shallowEqual` for one-level records and arrays/tuples. Contextual
hooks remain planned; hook-generated state and reducer adapters are not part of this surface.

Store-owned mode owns canonical values and persists them according to explicit policy.
External-owned mode projects one existing synchronous application store through an immutable root
adapter. Alpha persistence is Store-owned; persisting Picodash metadata for external-owned Stores is
an accepted beta target.

Read the [Store target reference](../../docs/reference/store.md),
[decision ledger](../../docs/reference/store-contract-decisions.md), and
[ADR 0002](../../docs/adr/0002-provider-level-store-and-scoped-views.md) before changing the
prototype.

## Verification

```bash
bun run --filter @picodash/store check
bun run --filter @picodash/store test
bun run --filter @picodash/store release:check
```
