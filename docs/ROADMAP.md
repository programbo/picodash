# Picodash contract-led roadmap

This roadmap sequences Store, DashPanel, and DashList as three loosely independent products,
supported by one shared UI foundation, followed by the integrated Picodash product. It guides
contract work and release maturity; it is not a calendar or delivery estimate.

## Status

> Contract: Accepted
> Implementation: Prototype
> Evidence: Product sequence, vertical-slice boundaries, release gates, and verification ownership
> are accepted. Product-specific conformance evidence remains implementation work.

## Phase 0: Complete the target documentation

Phase 0 is contract-complete. The accepted references define every initial public API, package
entrypoint, ownership boundary, and release gate that would materially change implementation. The
remaining CSS-consumption tables, measured compact values, and linked test evidence are produced
during implementation rather than used to keep the launch contracts in Draft.

Before treating prototype behavior as a public contract:

1. Record the accepted Store decisions and architecture.
2. Establish distinct value propositions for Store, DashPanel, DashList, and Picodash.
3. Pressure-test weak product propositions before accepting their detailed contracts.
4. Complete aspirational reference pages with explicit implementation status.
5. Build the conformance matrix that will track implementation evidence.
6. Record shared UI ownership without treating it as a fourth product.

Create one intentional documentation baseline commit before Phase 1 changes product code. Genuine
constraints discovered during implementation revise the owning accepted decision explicitly; the
prototype never revises the contract silently.

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

## Phase 2: Shared UI, DashPanel, and DashList dogfooding

Implement the minimum accepted `@picodash/ui` foundation required for independent UI-product work:
theme and density contracts, independent portal/layer context, semantic tokens, structural CSS, and
product-neutral primitives used by both products. DashPanel and DashList consume only public Store
and UI APIs. They do not depend on each other and may advance independently.

UI work is driven by demonstrated cross-product contracts, not speculative extraction. A component
enters UI only when both products use the same product-neutral semantics, accessibility, theme, and
interaction behavior without product state or commands.

### DashPanel

DashPanel exercises Provider hosting, scope ownership, durable layout overrides, transient panel
runtime, browser geometry, boundaries, portals, shared UI, and action composition. Deficiencies
found through DashPanel feed back into the owning Store or UI contract, implementation, tests, and
release status.

### DashList

DashList exercises standalone scope resolution, field bindings, drafts, groups, stable node
identity, ordering, collapse overrides, resets, documents, and accessible reordering. Deficiencies
found through DashList follow the same Store feedback loop.

DashList also exercises shared theme, density, header, and generic chrome contracts. Deficiencies
in those contracts feed back into UI; Dashlet and List behavior stays in DashList.

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
- primary List action contribution without implicit additional-List aggregation;
- shared UI, portals, documents, and ready-made Dashlets;
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
