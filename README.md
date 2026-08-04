# Picodash

Picodash is a React package family for adding configurable controls, readouts, visualizations, and
tool panels to an existing application. Use the panel and list products independently, or combine
them through the Picodash facade when an application needs both.

## Project status

> Contract: Store accepted; DashPanel, DashList, and Picodash draft
>
> Implementation: Working prototypes
>
> Release status: Public preview

Product implementation is temporarily paused while the aspirational contracts are completed and
reviewed. Existing source and tests are prototype evidence, not automatic compatibility
requirements. Issues remain open for feedback; pull requests are disabled until the contribution
workflow reopens.

## Products

| Package               | What it provides                                                                  |
| --------------------- | --------------------------------------------------------------------------------- |
| `@picodash/store`     | Typed values, atomic validation, scoped metadata, persistence, and adapters.      |
| `@picodash/dashpanel` | A movable Panel shell with configurable docking and durable layout.               |
| `@picodash/dashlist`  | Ordered, groupable Dashlet composition with typed bindings and durable ordering.  |
| `@picodash/picodash`  | The integrated facade for applications that need DashPanel and DashList together. |
| `@picodash/theme`     | Shared semantic theme tokens and theme context.                                   |

Store, DashPanel, and DashList are planned as loosely independent products. Store is implemented
first and then dogfooded by the two UI products. Picodash integration follows after all three
foundations are stable.

## Start with the contract

- [Product value propositions](docs/product/value-propositions.md)
- [Contract-led roadmap](docs/ROADMAP.md)
- [Store architecture decision](docs/adr/0002-provider-level-store-and-scoped-views.md)
- [Store target API](docs/reference/store.md)
- [DashPanel target reference](docs/reference/dashpanel.md)
- [DashList target reference](docs/reference/dashlist.md)
- [Picodash target reference](docs/reference/picodash.md)
- [Contract and implementation status rules](docs/reference/document-status.md)
- [Conformance matrix and release gates](docs/reference/contract-conformance.md)
- [Testing policy](TESTING.md)

The target references annotate intended behavior separately from current implementation status.
Package source and package READMEs may describe prototype behavior only when clearly labeled.

## Target composition

One root Store owns canonical field values and durable scope metadata. `root.scope(scopeId)` returns
an immutable organizational view of that same authority; it does not create a second value store or
restrict field access.

`DashPanelProvider` consumes a root Store for durable layout; each `DashPanel` supplies its scoped
view to descendants. Standalone DashList accepts a root or scoped Store and establishes the resolved
scope for its Dashlets. The integrated Picodash facade composes both products over one compatible
Store contract.

## Workspace

- `packages/store`: framework-independent Store prototype.
- `packages/theme`: semantic theme foundation.
- `packages/dashpanel`: standalone DashPanel prototype.
- `packages/dashlist`: standalone DashList prototype.
- `packages/picodash`: integrated facade prototype.
- `apps/web`: production Next.js evaluation site; `/` is its only public route.
- `apps/lab`: local Contract Lab and checked-in audit report viewer.
- `docs/adr`: architectural decisions.
- `docs/reference`: aspirational contracts, status, and conformance.

## Development

The repository uses Bun and Vite+ (`vp`).

```bash
bun install
vp check
vp run -r test
vp run -r build
```

Run the narrowest package check that owns a documentation or implementation change. Use
`bun run ready` only for the full release gate or when explicitly requested.

Local development commands:

```bash
bun run web
bun run lab
```

See [AGENTS.md](AGENTS.md) for current workspace rules, port allocation, documentation precedence,
and QA guidance.
