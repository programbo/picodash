# Picodash contract-led roadmap

This roadmap sequences Picodash as three loosely independent foundational products followed by an
integrated product. It guides contract work and release maturity; it is not a calendar or delivery
estimate.

## Status

> Contract: Draft
> Implementation: Prototype
> Evidence: Product-specific conformance evidence is not yet complete.

## Phase 0: Complete the target documentation

Before treating prototype behavior as a public contract:

1. Record the accepted Store decisions and architecture.
2. Establish distinct value propositions for Store, DashPanel, DashList, and Picodash.
3. Pressure-test weak product propositions before accepting their detailed contracts.
4. Complete aspirational reference pages with explicit implementation status.
5. Build the conformance matrix that will track implementation evidence.

## Phase 1: Store alpha

Develop `@picodash/store` as an independently useful product. A vertical Store slice includes its
public API, state invariants, validation, diagnostics, tests, and documentation without requiring a
UI product.

Expected slices include:

- typed fields, defaults, immutable snapshots, and atomic writes;
- canonical scoped views and scope lifecycle;
- structured validation and transaction errors;
- React hooks and selector behavior;
- Store-owned persistence and recovery;
- external value adapters;
- scoped metadata, registration, and relationship rules;
- import, export, redaction, and promotion.

Store alpha begins consumer dogfooding after core transactions/scopes, Store-owned metadata,
synchronous persistence, the manual external adapter, React selectors, and the supported integration
lease entry are usable without private imports. Documents and advanced recovery may continue toward
beta, but alpha cannot contain a partial-mutation path, silent conflict overwrite, or incomplete
pending envelope. It is not expected to have proven every ergonomic choice.

## Phase 2: DashPanel and DashList dogfooding

DashPanel and DashList consume only Store's public or deliberately shared composition APIs. They do
not depend on each other and may advance independently.

### DashPanel

DashPanel exercises Provider hosting, scope ownership, durable layout overrides, transient panel
runtime, browser geometry, boundaries, portals, themes, and action composition. Deficiencies found
through DashPanel feed back into Store's contract, implementation, tests, and release status.

### DashList

DashList exercises standalone scope resolution, field bindings, drafts, groups, stable node
identity, ordering, collapse overrides, resets, documents, and accessible reordering. Deficiencies
found through DashList follow the same Store feedback loop.

Store reaches beta only after real consumer work has exercised the contracts most likely to change.

## Phase 3: Foundational product stability

Store, DashPanel, and DashList each earn their own maturity based on their own release gates:

- public API and type checks;
- owned deterministic and component tests;
- only the Contract Lab journeys that require their browser behavior;
- packaging and artifact verification;
- required upstream conformance evidence.

One product does not inherit another product's complete test matrix.

## Phase 4: Picodash integration

`@picodash/picodash` integrates stable Store, DashPanel, and DashList contracts. Its work focuses on
combined behavior rather than concealing gaps in the foundations.

Expected slices include:

- a DashPanel and DashList sharing one root Store;
- same-scope primary Lists and explicit child scopes;
- Provider ancestry and declarative relationship registration;
- aggregate actions across active descendants;
- shared themes, portals, documents, and ready-made Dashlets;
- facade packaging and integrated examples.

Integration findings feed back into the product that owns the deficient behavior.

## QA strategy

Contracts do not require one test per sentence. Each behavior has one primary owner and uses the
cheapest faithful test layer. Deterministic matrices remain below the browser; Contract Lab journeys
prove only real layout, pointer, focus, portal, storage, media-query, and cohesive integration seams.

A small cross-package smoke harness may detect incompatible public contracts before the Picodash
phase. It must not become premature integrated-product development or duplicate lower-level tests.

See [TESTING.md](../TESTING.md) and the
[conformance matrix](reference/contract-conformance.md).
