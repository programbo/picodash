# Picodash agent guide

This file routes agents to current product contracts and records only workspace-wide operating
rules. It is not a duplicate API reference.

## Implementation hold

Product implementation is paused while the aspirational contracts are completed and reviewed.

Do not begin Store, DashPanel, DashList, or Picodash implementation until:

- Store's accepted contract and target API have been checked for internal consistency;
- the DashPanel and DashList gap sessions have resolved their open contract questions;
- product value propositions have been accepted;
- the conformance matrix has agreed owners and release gates; and
- the documentation no longer leaves an implementation choice that would materially change product
  behavior or package ownership.

Documentation, contract analysis, prototype inspection, and QA planning remain in scope during this
hold. Current code is reference evidence, not an implicit compatibility requirement.

## Start here

Read the smallest document that owns the question:

| Question                                      | Authoritative document                                                                                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| What does each product offer?                 | [Product value propositions](docs/product/value-propositions.md)                                                           |
| What is the product sequence?                 | [Contract-led roadmap](docs/ROADMAP.md)                                                                                    |
| Why does Store use root and scoped views?     | [ADR 0002](docs/adr/0002-provider-level-store-and-scoped-views.md)                                                         |
| What exact Store decision was accepted?       | [Store contract decisions](docs/reference/store-contract-decisions.md)                                                     |
| What is the target Store API?                 | [Store target reference](docs/reference/store.md)                                                                          |
| What is the target DashPanel API?             | [DashPanel target reference](docs/reference/dashpanel.md)                                                                  |
| What is the target DashList API?              | [DashList target reference](docs/reference/dashlist.md)                                                                    |
| What does integrated Picodash own?            | [Picodash target reference](docs/reference/picodash.md)                                                                    |
| Is a documented feature shipped and verified? | [Documentation status](docs/reference/document-status.md) and [conformance matrix](docs/reference/contract-conformance.md) |
| Where should a behavior be tested?            | [Testing policy](TESTING.md) and [conformance matrix](docs/reference/contract-conformance.md)                              |
| What does the prototype package export now?   | The package README and current source, explicitly treated as prototype evidence                                            |

When documents conflict, use this precedence:

1. Accepted ADRs and accepted decisions.
2. Accepted sections of target references.
3. The roadmap and documentation-status rules.
4. Current code, tests, and package READMEs as prototype evidence.
5. Historical documents, including superseded ADR 0001 and unreconciled `PRODUCT.md`/`CONTEXT.md`.

Do not silently revise an accepted contract to match an implementation shortcut. Record a genuine
constraint and revise the decision explicitly.

## Product model and value

### Store

`@picodash/store` is a typed state foundation for configurable React interfaces. It provides one
synchronous, validated value authority plus scoped Panel/List metadata. It may own values and
persistence or adapt an existing application store.

Store is independently useful and is the first product in the roadmap.

### DashPanel

`@picodash/dashpanel` is a standalone React panel shell for movable, dockable, dismissible arbitrary
content. It supplies Provider hosting, configurable dock positions, collision-safe dock allocation,
boundaries, portals, accessible actions, transient visibility/activation, and Store-backed durable
layout overrides without requiring DashList.

### DashList

`@picodash/dashlist` is a standalone React composition system for ordered, groupable controls,
readouts, visualizations, previews, and actions. It supplies typed bindings, drafts, accessible
reordering, and durable order/collapse overrides without requiring DashPanel.

### Picodash

`@picodash/picodash` integrates Store, DashPanel, DashList, themes, and ready-made Dashlets. It is a
facade and control-interface product, not an application framework or monolithic Dashboard
component.

Applications continue to own routing, data transport, authentication, authorization, exposure
policy, and declarative JSX composition.

## Roadmap boundaries

1. Complete Store contracts and reach a useful Store alpha.
2. Dogfood Store independently through DashPanel and DashList.
3. Feed consumer findings back into Store before Store beta/stability.
4. Stabilize DashPanel and DashList against their own release gates.
5. Build Picodash integration after the three foundations are stable.

A vertical slice stays within the product currently being developed. Higher products may expose a
foundation gap, but they do not solve it through private bypasses.

A small cross-package smoke harness may detect public-contract incompatibility. It must not become
premature Picodash implementation or duplicate lower-layer tests.

## Glossary

- **Picodash:** the integrated product and `@picodash/picodash` facade. Preserve lowercase `d`.
- **Store:** the framework-independent typed state product in `@picodash/store`.
- **Root Store:** one value authority, field set, persistence identity, and durable scope registry.
- **Scoped Store:** an immutable view of a root Store attributed to one `scopeId`; it still exposes
  every root field and value.
- **Scope:** a root-global organizational identity for durable metadata, registration, management,
  and operation attribution. It is not a value copy, string hierarchy, or authorization boundary.
- **Provider:** a hard Store/scope-ancestry and Panel-host boundary. `DashPanelProvider` is the
  standalone target; `PicodashProvider` is the integrated facade Provider and current prototype.
- **Provider ID:** runtime host identity within one root Store. It does not namespace scopes.
- **DashPanel:** the standalone panel product and target component name. `PicodashPanel` is the
  current prototype name, not a second standalone component contract.
- **Dock position:** one named flush Panel placement target such as `top-left` or `full-right`.
- **Dock arena:** Panels sharing Provider, resolved boundary identity, and resolved inset.
- **Dock slot:** the collision identity claimed by a docked Panel; full and center targets on the
  same main edge share a slot.
- **Dock occupancy:** the transient committed lifecycle lease between a Panel and a dock slot.
- **Dock allocation:** the transient size cap assigned to docked occupants sharing an edge; it is
  recomputed from current occupancy and never persisted.
- **DashList:** the standalone List/Dashlet composition product. `PicodashList` is the current
  prototype component name; final public naming remains under review.
- **DashGroup:** a declarative DashList container with its own stable node ID and optional collapse
  override. A group is not a Store scope.
- **Dashlet:** one composable control, readout, visualization, preview, action, or compound item
  inside a DashList.
- **Dashboard:** an application composition of Panels and Dashlets, not a required Picodash
  component abstraction.
- **Field:** one immutable root-owned typed value contract.
- **Field handle:** the nominal root-owned object used to bind a component to a field.
- **Binding:** one presentation/editor of a field, identified by scope, item, and alias. Drafts and
  input issues belong to bindings.
- **Binding handle:** an opaque root- and registration-generation-owned handle used by interaction
  commands; it is not reconstructed from strings.
- **Canonical value:** the complete validated root value observed by every scope.
- **Baseline:** field defaults merged with validated initial values before persistence overlays.
- **Durable metadata:** Panel layout and DashList order/collapse overrides that may be persisted.
- **Interaction state:** ephemeral draft, touched, input issue, focus, hover, active, and conflict
  state. It is never persisted.
- **Host runtime:** Provider-local portals, boundaries, visibility, activation, and z-order.
- **Adapter:** the synchronous whole-record bridge to an externally owned application value store.
- **Document:** a versioned export/import projection with explicit Store/scope identity and field
  disclosure policy.
- **Plan:** an opaque, root-owned, single-use description of a repair, overwrite, prune, persistence,
  export, or import operation; stale plans fail without mutation.
- **Contract status:** whether a behavior is Draft, Accepted, or Revised.
- **Implementation status:** whether behavior is Prototype, Planned, Partial, Implemented, or
  Verified.

## Package boundaries

- `@picodash/store` owns framework-independent values, scopes, transactions, adapters, persistence,
  documents, durable metadata, and diagnostics.
- `@picodash/store/react` owns public Store hooks and typed selectors.
- `@picodash/store/integration` owns the supported advanced context and declarative lifecycle-lease
  protocol used by the separate UI packages.
- `@picodash/theme` owns shared semantic theme contracts and tokens.
- `@picodash/dashpanel` owns Panel/Provider composition and placement exports.
- `@picodash/dashlist` owns List, group, Dashlet anatomy, binding composition, ordering, and collapse
  presentation.
- `@picodash/picodash` integrates and reexports stable foundational contracts.

DashPanel and DashList depend on compatible Store/theme packages, not on one another. Store never
depends on either UI product: it owns validated JSON persistence records for their built-in metadata,
while the UI packages own public behavior and prop types.

Do not document retired package paths, `apps/demo`, or the legacy imperative Panel deregistration
model as current targets.

## Prototype policy

The current implementation congealed before the new product contracts were explicit. Treat every
existing API and test as a working prototype until it is reconciled with the target reference.

- Prototype behavior may be retained, redesigned, or removed.
- Clean pre-v1 breaks are preferred over aliases unless compatibility is requested explicitly.
- Existing tests do not confer contract status automatically.
- Useful prototype behavior advances only after its owner, target contract, and evidence are clear.
- Package READMEs currently describe shipped prototype APIs and must not override accepted target
  decisions.

## QA strategy

One contract has one primary test owner. Verify it at the cheapest layer that can faithfully observe
the behavior.

- Store pure/type/model tests own data and state invariants.
- DashPanel/DashList component tests own React wiring, semantic DOM, ARIA, and deterministic events.
- Pure product tests own geometry, ordering, reconciliation, and graph algorithms.
- Contract Lab E2E owns only real layout, pointer capture, focus traversal/restoration, portals,
  browser storage, media queries, viewport, zoom, and cohesive browser seams.
- Picodash integration tests prove composition without repeating foundational matrices.
- Website E2E proves public journeys, not internal permutations.

Do not add one test per documented sentence. Use table-driven, property-based, or model-based tests
for large state spaces.

For regressions:

1. Identify the violated contract and primary owner.
2. Expand the existing invariant test at the lowest faithful layer.
3. Add browser evidence only when the failure requires a browser.
4. Merge it into a cohesive existing journey when possible.
5. Remove overlapping or obsolete tests in the same cutover.

The Contract Lab hard ceiling remains 40 collected tests and is not a target. There are no legacy,
quarantine, skip, fixme, retry-only, or hidden browser suites. See [TESTING.md](TESTING.md).

## Repository topology

- `packages/store`: Store prototype and tests.
- `packages/theme`: shared theme foundation.
- `packages/dashpanel`: standalone DashPanel prototype.
- `packages/dashlist`: standalone DashList prototype.
- `packages/picodash`: integrated facade prototype.
- `apps/web`: production Next.js evaluation website; `/` is the only public route.
- `apps/lab`: local Contract Lab at `/lab` plus checked-in audit report rendering.
- `docs/adr`: architectural decisions.
- `docs/reference`: aspirational contracts, status, decisions, and conformance.
- `docs/product`: product positioning and value.

Generated `dist/` output is never edited directly.

## Toolchain

The workspace uses Vite+ through the global `vp` CLI. Vite+ wraps Vite, Rolldown, Vitest, tsdown,
Oxlint, Oxfmt, and task execution. Local documentation is in `node_modules/vite-plus/docs`.

Use Bun for workspace scripts and package management.

## Verification commands

Run the narrowest owning check first. Do not run broad suites merely because they exist.

```bash
bun install
vp check
vp run -r test
vp run -r build
```

Focused product commands:

```bash
bun run --filter @picodash/store check
bun run --filter @picodash/store test
bun run --filter @picodash/dashpanel check
bun run --filter @picodash/dashlist check
bun run --filter @picodash/picodash check
```

Browser suites:

```bash
bun run test:e2e:lab:cap
bun run test:e2e:lab
bun run test:e2e:web
```

Release/full gate:

```bash
bun run release:check
bun run ready
```

`bun run ready` runs audit, release, artifact, evaluation, check, test, build, and both E2E gates.
Use it for a release boundary or when explicitly requested, not for every documentation edit.

If setup or Vite+ behavior is wrong, run `vp env doctor` and retain its output.

## Development servers and ports

- `6030`: web development server (`WEBSITE_PORT`).
- `6031`: web production preview (`WEBSITE_PORT`).
- `6032`: Lab development server (`LAB_PORT`).
- `6033`: web E2E server (`WEBSITE_PORT`).
- `6034-6039`: temporary worktree allocations.

Use `bun run port:reserve` in a worktree and `bun run port:release` after its work is merged. Do not
invent ports outside the allocated range.

## Cross-cutting implementation rules

These rules are already accepted or protect current high-risk behavior:

- Keep canonical values and persisted payloads strict JSON data.
- Validate a complete candidate batch before any canonical mutation.
- Keep binding-input parsers, Standard Schema contracts, validators, adapters, and core persistence
  synchronous. UI parsers do not run against defaults, persisted data, adapter snapshots, imports,
  or migration output.
- Keep high-frequency pointer/visual state outside persisted Store snapshots.
- Persist settled overrides, not declared defaults, previews, visibility, focus, activation, or
  z-order.
- Preserve pointer and keyboard outcome parity for reorder and placement.
- Keep custom parser/validator callback identities stable across React renders.
- Use semantic `--picodash-*` tokens and public component variants instead of internal classes.
- Preserve provider portal, z-index, theme, and accessible overlay contracts.
- Treat invalid/obsolete prototype persistence as current-default recovery; do not invent silent
  compatibility migrations.

Detailed placement and boundary behavior belongs in the DashPanel reference, package README, and
owning geometry tests—not in this guide.

## Documentation maintenance

- Contract changes update the decision ledger and affected target reference.
- Ownership, identity, persistence, or package-boundary changes require an ADR amendment or new ADR.
- Implementation changes update status and conformance evidence in the same change.
- Public command, package-entrypoint, or workspace-topology changes update this guide and relevant
  operational/package README.
- Examples that become normative should be typechecked or exercised as fixtures.
- Do not copy complete API reference material into `AGENTS.md`, `README.md`, `SKILL.md`, or `llms.txt`.
  Link to its owner instead.

## Copy quality

Product copy leads with the concrete product, user, and outcome. Technical architecture follows
only when it explains a user-visible benefit or constraint.

- Prefer specific nouns and outcomes: Panels, Lists, Dashlets, typed values, placement, ordering,
  persistence, and adapters.
- Do not use generic claims such as “powerful,” “seamless,” or “modern.”
- Do not use metaphors such as “surface,” “journey,” or “without the ceremony” in place of behavior.
- Documentation begins with one factual purpose sentence and uses realistic examples.
- Preserve `Picodash`, `DashPanel`, `DashList`, `Dashlet`, and the `@picodash` package scope exactly.
