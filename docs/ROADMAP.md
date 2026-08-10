# Picodash contract-led roadmap

This roadmap sequences Store, DashPanel, and DashList as three loosely independent products,
supported by one shared UI foundation, followed by the integrated Picodash product. It guides
contract work and release maturity; it is not a calendar or delivery estimate.

Dev Bridge is a continuous development instrument from consumer dogfooding through integration and
stability. It is not a fourth product phase, a production dependency, or an alternate Store
authority.

## Status

> Contract: Revised
> Implementation: Prototype
> Evidence: Product sequence, vertical-slice boundaries, release gates, continuous Dev Bridge
> dogfooding, and verification ownership are accepted. Product-specific conformance evidence
> remains implementation work.

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

### Continuous Dev Bridge dogfooding

DashPanel and DashList development uses the verified Dev Bridge baseline as a separate consumer of
public Store APIs. Every vertical slice whose outcome can be observed through explicitly disclosed
Store state, transaction results, diagnostics, or a correlated browser-visible effect must use the
Bridge in Contract Lab. Browser evidence still owns focus, pointer, geometry, portal, and
accessibility behavior; Bridge evidence independently records what Store exposed, accepted, or
rejected.

For each applicable slice:

1. Use Bridge discovery, inspection, allowlisted writes, and bounded waits where they provide
   faithful Store evidence.
2. Correlate that evidence with the real browser consumer instead of treating a Bridge-only command
   as UI conformance.
3. If missing or awkward Bridge behavior materially slows inspection, automation, or verification,
   evaluate and prioritize the smallest safe Bridge improvement before adding a product workaround.
4. Exercise every new Bridge capability against a real public Store consumer before relying on it.
5. Feed a generally useful Store gap back into Store with Store-owned tests and documentation;
   retain Panel, List, Dashlet, focus, placement, and ordering behavior in their owning packages.

A slice is incomplete when it bypasses an applicable existing Bridge capability without recording
why the behavior is browser-only or otherwise outside the Bridge's explicit disclosure and command
surface. Continuous improvement does not authorize arbitrary runtime inspection, private Store
access, production operation, or implementation of deferred dangerous commands without their
required safety contracts.

### DashPanel

DashPanel exercises Provider hosting, scope ownership, durable layout overrides, transient panel
runtime, browser geometry, boundaries, portals, shared UI, and action composition. Deficiencies
found through DashPanel feed back into the owning Store or UI contract, implementation, tests, and
release status.

Bridge dogfooding covers disclosed Store-backed layout, lifecycle, transaction, and diagnostic
outcomes. Contract Lab browser evidence remains authoritative for geometry, movement, focus,
portals, and adaptive presentation.

### DashList

DashList exercises standalone scope resolution, field bindings, drafts, groups, stable node
identity, ordering, collapse overrides, resets, documents, and accessible reordering. Deficiencies
found through DashList follow the same Store feedback loop.

Bridge dogfooding covers disclosed canonical values, bindings, metadata, action results, document
effects, and diagnostics. Drafts, plans, or document contents are not disclosed merely to make a
test convenient.

DashList also exercises shared theme, density, header, and generic chrome contracts. Deficiencies
in those contracts feed back into UI; Dashlet and List behavior stays in DashList.

Store reaches beta only after real consumer work, including applicable Bridge-backed Contract Lab
evidence, has exercised the contracts most likely to change.

## Phase 3: Foundational product stability

Store, DashPanel, and DashList each earn their own maturity based on their own release gates:

- public API and type checks;
- owned deterministic and component tests;
- only the Contract Lab journeys that require their browser behavior;
- Bridge-backed evidence for applicable disclosed Store-visible outcomes, or an explicit reason the
  behavior is browser-only or outside Bridge policy;
- packaging and artifact verification;
- required upstream conformance evidence.

One product does not inherit another product's complete test matrix.

Dev Bridge improvement continues during stabilization. A regression or release-candidate gap that
cannot be diagnosed or verified through the safe existing surface triggers the same smallest-safe
improvement review used in Phase 2. Any Bridge change keeps its own protocol, security, package, and
real-consumer evidence. Consumer stability does not require speculative Bridge features or deferred
dangerous operations that no accepted consumer contract needs.

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

Applicable integration slices use Dev Bridge to correlate the facade's browser behavior with the
same public Store observations and commands available to standalone consumers. Picodash receives no
private Bridge API and does not make Dev Bridge a production dependency. If integrated dogfooding
reveals a missing safe observation or command, improve the owning public foundation or the Bridge's
explicit capability before adding a facade-only inspection path.

Integration findings feed back into the product that owns the deficient behavior. New Bridge
capabilities remain owner-neutral until real evidence justifies a separately owned DashPanel or
DashList development extension.

## QA strategy

Contracts do not require one test per sentence. Each behavior has one primary owner and uses the
cheapest faithful test layer. Deterministic matrices remain below the browser; Contract Lab journeys
prove only real layout, pointer, focus, portal, storage, media-query, and cohesive integration seams.

For a Contract Lab journey with an applicable disclosed Store-visible outcome, QA combines three
distinct forms of evidence:

1. The owning deterministic or component test proves the contract invariant.
2. Browser assertions prove the real UI, input, focus, layout, portal, storage, or accessibility
   behavior.
3. Dev Bridge inspection or waits independently confirm the disclosed Store outcome and structured
   result without becoming the UI oracle.

When Bridge evidence is not applicable, the conformance entry records the browser-only or policy
reason rather than manufacturing a Bridge command. Every added Bridge capability receives focused
protocol and security tests plus at least one real public-consumer journey. A Bridge-only success
never proves UI conformance, and browser automation never justifies bypassing Store validation or
Bridge disclosure boundaries.

A small cross-package smoke harness may detect incompatible public contracts before the Picodash
phase. It must not become premature integrated-product development or duplicate lower-level tests.

See [TESTING.md](../TESTING.md) and the
[conformance matrix](reference/contract-conformance.md).
