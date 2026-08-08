# Store agent instructions

Read this file before changing Store implementation or contracts. Then read
[`../reference/store-contract-decisions.md`](../reference/store-contract-decisions.md),
[`../reference/store.md`](../reference/store.md), and
[`../adr/0002-provider-level-store-and-scoped-views.md`](../adr/0002-provider-level-store-and-scoped-views.md).

## Decision lens

Store determines what state means and which changes are valid. Preserve one synchronous,
validated canonical value authority that can either own values or adapt an existing application
store. Scopes organize durable Panel and List metadata and operation attribution; they do not copy
values or create authorization boundaries.

Treat Dev Bridge, DashPanel, and DashList as independent public Store consumers. When one exposes a
general gap, improve the public Store contract and verify the other consumers remain coherent. Do
not add consumer-specific backdoors or make Store depend on UI packages or Dev Bridge.

## Implementation constraints

- Keep fields and field handles root-owned and nominal.
- Keep adapters, core persistence, validators, Standard Schema contracts, and canonical writes
  synchronous.
- Validate the complete candidate record before committing any mutation.
- Keep values and persistence payloads strict JSON data.
- Keep durable Panel/List metadata Store-owned, but keep the products' behavior and public prop
  types in their owning UI packages.
- Persist settled overrides only. Drafts, input issues, focus, hover, visibility, activation,
  z-order, drag previews, and other interaction state are ephemeral.
- Preserve structured issues, atomic transaction results, plan freshness, and explicit document
  disclosure. Do not normalize contract errors into ordinary rejection results.
- Public advanced consumption belongs in `@picodash/store/integration`; never require private
  imports from DashPanel, DashList, Picodash, or Dev Bridge.

## Evidence

Store pure, type, reducer, serialization, and model tests own its invariants. Use the focused
package check and tests first. Add browser evidence only when the behavior genuinely depends on a
browser seam.
