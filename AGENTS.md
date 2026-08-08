# Picodash agent guide

This file is the repository's guaranteed instruction entrypoint. It contains workspace-wide rules
and explicit routes to narrower instructions. Do not assume a package-level `AGENTS.md` or linked
document was loaded automatically.

## Required instruction loading

Before editing files, match every affected route below and read every listed document. These are
mandatory instructions, not optional background. If a change crosses several routes, read all of
them. Re-read the routes when the task expands into another package.

- Store implementation or contracts: [`docs/agents/store.md`](docs/agents/store.md),
  [`docs/reference/store-contract-decisions.md`](docs/reference/store-contract-decisions.md), and
  [`docs/reference/store.md`](docs/reference/store.md).
- Dev Bridge or agent-facing inspection: [`docs/agents/dev-bridge.md`](docs/agents/dev-bridge.md),
  [`docs/development/agent-dev-bridge.md`](docs/development/agent-dev-bridge.md), and
  [`packages/dev-bridge/README.md`](packages/dev-bridge/README.md).
- Shared UI or replacement of `packages/theme`: [`docs/agents/ui.md`](docs/agents/ui.md),
  [`docs/adr/0003-shared-ui-foundation.md`](docs/adr/0003-shared-ui-foundation.md), and
  [`docs/reference/ui.md`](docs/reference/ui.md).
- DashPanel behavior or docs: [`docs/agents/dashpanel.md`](docs/agents/dashpanel.md) and
  [`docs/reference/dashpanel.md`](docs/reference/dashpanel.md).
- DashList or Dashlet behavior or docs: [`docs/agents/dashlist.md`](docs/agents/dashlist.md) and
  [`docs/reference/dashlist.md`](docs/reference/dashlist.md).
- Picodash or cross-product integration: [`docs/agents/picodash.md`](docs/agents/picodash.md) and
  [`docs/reference/picodash.md`](docs/reference/picodash.md).
- Product copy, examples, or package READMEs: the matching package route,
  [`docs/product/value-propositions.md`](docs/product/value-propositions.md), and
  [`docs/agents/copy.md`](docs/agents/copy.md).
- Catalog work: [`docs/reference/catalog.md`](docs/reference/catalog.md) and the matching product
  reference.
- Contract status: [`docs/reference/document-status.md`](docs/reference/document-status.md) and
  [`docs/reference/contract-conformance.md`](docs/reference/contract-conformance.md).
- Tests or browser evidence: [`docs/agents/testing.md`](docs/agents/testing.md),
  [`TESTING.md`](TESTING.md), and the matching product reference.
- Apps, servers, or ports: [`docs/agents/apps.md`](docs/agents/apps.md). For `apps/web`, also read
  [`apps/web/AGENTS.md`](apps/web/AGENTS.md) explicitly.
- Roadmap decisions: [`docs/ROADMAP.md`](docs/ROADMAP.md) and all affected package guides.

For questions that do not map cleanly, start with the smallest authoritative document in
`docs/reference/` and expand only when it links to an owning decision or ADR. External files are
loaded on demand through the explicit rules above; they are not transcluded into this file.

## Authority and contract discipline

When documents conflict, use this precedence:

1. Accepted ADRs and accepted decisions.
2. Accepted sections of target references.
3. The roadmap and documentation-status rules.
4. Current code, tests, and package READMEs as prototype evidence.
5. Historical documents, including superseded ADR 0001 and unreconciled `PRODUCT.md` or
   `CONTEXT.md`.

Do not silently revise an accepted contract to match an implementation shortcut. Record a genuine
constraint and revise the decision explicitly. Current code remains prototype evidence, not an
implicit compatibility requirement. Prefer clean pre-v1 breaks over aliases unless compatibility
is explicitly required.

Implementation follows the accepted Store, shared UI, DashPanel, DashList, and Picodash roadmap.
Do not skip ahead through private cross-package APIs. A higher product may reveal a foundation gap,
but it must not solve that gap through a private bypass.

## Package value propositions

Use these propositions to guide scope, API decisions, examples, and documentation. Read the fuller
accepted explanation in [`docs/product/value-propositions.md`](docs/product/value-propositions.md)
before changing product behavior or public copy.

### `@picodash/store`

Store is a typed state foundation for configurable React interfaces. It gives applications one
synchronous, validated value authority plus scoped Panel and List metadata while allowing the
application to retain an existing state library through an adapter. Its value is predictable state
meaning: typed fields, atomic changes, drafts, persistence, repair, documents, and diagnostics that
all consumers can share without inventing their own rules.

Store is independently useful and renders no UI. It owns state meaning and valid changes, not
Panel placement, List composition, authentication, or authorization.

### `@picodash/ui`

UI is the shared presentation foundation that lets DashPanel and DashList look and behave
consistently without duplicating theme, density, overlay, token, and generic accessibility work.
It exists so product packages can concentrate on their distinct behavior while applications can
provide one coherent visual contract.

UI supports the products; it is not a separately marketed control-interface product and owns no
Store, Panel, List, Dashlet, placement, ordering, or persistence behavior.

### `@picodash/dashpanel`

DashPanel is a standalone React panel shell for adding movable, dockable, dismissible arbitrary UI
without rebuilding window management, boundaries, portals, accessible actions, adaptive modal
presentation, and durable placement. Its decisions should make application-owned tools, previews,
and readouts reliable wherever they are placed—not assume that their content is a DashList.

DashPanel determines where UI lives. It owns Panel hosting and placement behavior, not the
content's form, ordering, field bindings, or application-value model.

### `@picodash/dashlist`

DashList is a standalone React composition system for ordered, groupable controls, readouts,
visualizations, previews, and actions backed by typed Store fields. It saves applications from
rebuilding binding drafts, accessible reordering, grouping, collapse behavior, durable user order,
and the relationship between canonical values and compound controls.

DashList determines how Dashlets are organized and operated. It owns List and Dashlet composition,
not floating placement, Panel hosting, portals, routing, or application transport.

### `@picodash/picodash`

Picodash is the integrated control and monitoring interface built from Store, DashPanel, DashList,
and UI. It lets a developer or coding agent add configurable controls, live readouts,
visualizations, previews, and actions to an existing application without inventing the state,
Panel, and List infrastructure separately.

Picodash is an integration facade, not a monolithic Dashboard component or application framework.
Applications retain routing, transport, authentication, authorization, exposure policy, and JSX
composition.

### `@picodash/dev-bridge`

Dev Bridge is a private development adapter over the public Store contract. It lets coding agents
discover an explicitly disclosed browser session, inspect state, make allowlisted writes, and wait
for observable changes without receiving arbitrary runtime authority. Its value is a short,
verifiable feedback loop between an agent's intent, Store behavior, and the real browser UI.

Dev Bridge is development tooling, not a production product or alternate state authority. It must
preserve Store validation, disclosure, generation, and security boundaries.

## Concurrent Store-consumer dogfooding

Treat Dev Bridge, DashPanel, and DashList as three concurrent consumers of the public Store
contract. Improvements discovered by one consumer must strengthen the shared public contract when
the need is general; they must not create consumer-specific private access.

When developing DashPanel or DashList:

1. Use Dev Bridge in the Contract Lab whenever the behavior can be observed through disclosed
   Store state, mutation results, diagnostics, or browser-visible effects.
2. Keep the other UI consumer in mind when changing Store contracts. A convenience that only fits
   one package is not automatically a Store abstraction.
3. If missing or awkward Dev Bridge behavior makes the DashPanel or DashList task harder to inspect,
   automate, or verify, prioritize the smallest safe Dev Bridge improvement before continuing the
   product workaround.
4. Exercise the new Bridge capability against a real public Store consumer before relying on it.
5. Feed genuine Store contract gaps back into Store with its tests and documentation; do not add a
   Bridge-only Store bypass.

This priority does not broaden Bridge authority. Production refusal, loopback binding,
authentication, explicit disclosure and write allowlists, generation fencing, and redacted errors
remain mandatory. The one-port-per-worktree rule applies to web application servers; Dev Bridge may
use as many ephemeral loopback ports as its relay and browser broker require.

## Package and ownership boundaries

- `@picodash/store` owns values, scopes, transactions, adapters, persistence, documents, durable
  metadata, diagnostics, React selectors, and its public integration lease protocol.
- `@picodash/ui` owns product-neutral theme, density, tokens, structural CSS, overlays, and generic
  accessible primitives used unchanged by both UI products.
- `@picodash/dashpanel` owns Panel and Provider composition, placement, hosting, and Panel actions.
- `@picodash/dashlist` owns Lists, groups, Dashlets, bindings, ordering, collapse, List actions,
  unbound DashList controls, and package-owned catalog entries.
- `@picodash/picodash` integrates and explicitly reexports stable foundation contracts. A component
  belongs here only when it necessarily coordinates DashPanel and DashList behavior.
- `@picodash/dev-bridge` consumes public Store behavior for local agent tooling. Store never depends
  on it.

DashPanel and DashList depend on compatible Store and UI foundations, not on one another. Do not
use blanket exports or cross-package source imports. Generated `dist/` output is never edited
directly. The exact accepted entrypoints and component surfaces live in the matching target
references and must be read before package work.

## Roadmap boundaries

1. Complete Store contracts and reach a useful Store alpha.
2. Establish the shared UI foundation needed by both UI products.
3. Dogfood Store, UI, and Dev Bridge independently through DashPanel and DashList.
4. Feed consumer findings back into their owning foundations before stability.
5. Stabilize DashPanel and DashList against their own release gates.
6. Build Picodash integration after the three products are stable.

A vertical slice stays within the product currently being developed. A small cross-package smoke
harness may detect public-contract incompatibility, but it must not become premature Picodash
implementation or duplicate lower-layer tests.

## Workspace rules

- Keep canonical values and persisted payloads strict JSON data.
- Validate complete candidate batches before canonical mutation.
- Keep high-frequency pointer and visual state outside persisted Store snapshots.
- Persist settled overrides, not declared defaults, previews, visibility, focus, activation, or
  z-order.
- Preserve pointer and keyboard outcome parity for reordering and placement.
- Use semantic `--picodash-*` tokens and public variants instead of internal classes.
- Preserve Provider portal, z-index, theme, focus, and accessible overlay contracts.
- Treat invalid or obsolete prototype persistence as current-default recovery; do not invent silent
  compatibility migrations.
- Keep public React 19 examples framework-neutral. Limit Next.js guidance to the client boundary
  and global stylesheet import unless a separate host contract is accepted.

The workspace uses Bun and Vite+ (`vp`). Use `rg` for search. Run the narrowest owning check first;
do not run broad suites merely because they exist. Use `bun run ready` only for a release boundary
or when explicitly requested. If toolchain setup is wrong, run `vp env doctor` and retain its
output.

For local servers, reserve the worktree's Hermes range with `bun run port:reserve` and release it
with `bun run port:release` after the work is merged. Do not invent web-server ports outside the
allocated range. Read [`docs/agents/apps.md`](docs/agents/apps.md) before starting or changing a
server.

## Documentation maintenance

- Contract changes update the decision ledger and affected target reference.
- Ownership, identity, persistence, or package-boundary changes require an ADR amendment or new
  ADR.
- Implementation changes update status and conformance evidence in the same change.
- Public commands, package entrypoints, or workspace topology changes update the relevant agent
  route and operational or package README.
- Normative examples should be typechecked or exercised as fixtures.
- Do not copy complete API references into agent guides, READMEs, skills, or `llms.txt`; link to the
  owner instead.

## Repository map

- `packages/store`: Store prototype and tests.
- `packages/dev-bridge`: private authenticated loopback Store inspection bridge.
- `packages/theme`: theme prototype scheduled to be replaced by `packages/ui`.
- `packages/dashpanel`: standalone DashPanel prototype.
- `packages/dashlist`: standalone DashList prototype.
- `packages/picodash`: integrated facade prototype.
- `apps/web`: production Next.js evaluation website; `/` is the only public route.
- `apps/lab`: Contract Lab at `/lab` plus checked-in audit report rendering.
- `docs/agents`: focused instructions loaded through the routing table in this file.
- `docs/adr`: architectural decisions.
- `docs/reference`: target contracts, status, decisions, and conformance.
- `docs/product`: product positioning and value.
