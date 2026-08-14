# `@picodash/nexus`

Picodash Nexus connects settings panels, inspectors, and control dashboards to typed application
state, adding validation, drafts, saved preferences, and import/export without forcing a second
source of truth. It can own the values or adapt an existing synchronous state store; multi-field
changes are validated as a complete candidate and committed atomically.

## Status

> Contract: Accepted target API
>
> Implementation: Partial overall; Nexus beta verified for consumer dogfooding

Reconciling implementation evidence is tracked in [Nexus Reconciliation Ledger](./RECONCILIATION.md); these entries describe current branch transitions only and do not assign contract status.

The Nexus beta release gate is verified through the public root, React, integration, and Web Storage
entries plus Contract Lab consumer/browser proof. Core/scoped values, binding interaction, durable
metadata, Nexus-owned and external-owned persistence, documents, migrations, recovery plans, the
manual external adapter, selectors, diagnostics, and declarative leases are ready for consumer
dogfooding. Broader runtime inspection and later product-owned UX remain unfinished.

## Target package surfaces

- `@picodash/nexus`: root/scoped Nexuses, nominal fields and their type-only value views,
  transactions, persistence, documents, diagnostics, and the manual external-value adapter
  contract.
- `@picodash/nexus/react`: explicit Nexus selector subscriptions and `shallowEqual`.
- `@picodash/nexus/integration`: supported advanced context and declarative lease protocol for
  DashPanel, DashList, and other declarative product integrations.

The root entry is framework-independent and must load without React. React is required only for the
React-facing entries.

The React entry currently exports `usePicodashNexusSelector(nexus, selector, equalityFn?)` for an
explicit root or scoped Nexus, plus `shallowEqual` for one-level records and arrays/tuples. Contextual
hooks remain planned; hook-generated state and reducer adapters are not part of this surface.

Nexus-owned mode owns canonical values and persists them according to explicit policy.
External-owned mode projects one existing synchronous application store through an immutable root
adapter and can persist Picodash metadata without persisting adapter-owned values.

Read the [Nexus target reference](../../docs/reference/nexus.md),
[decision ledger](../../docs/reference/nexus-contract-decisions.md), and
[ADR 0002](../../docs/adr/0002-provider-level-nexus-and-scoped-views.md) before changing the
prototype. The [Nexus naming ADR](../../docs/adr/0005-picodash-nexus-name-and-public-identity.md)
defines the public vocabulary and preserves “store” for external application state authorities.

## Verification

```bash
bun run --filter @picodash/nexus check
bun run --filter @picodash/nexus test
bun run --filter @picodash/nexus release:check
```
