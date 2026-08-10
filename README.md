# Picodash

Picodash is a React package family for adding configurable controls, readouts, visualizations, and
tool panels to an existing application. Use the panel and list products independently, or combine
them through the Picodash facade when an application needs both.

## Project status

> Contract: Initial Store, UI, DashPanel, DashList, and Picodash targets accepted
>
> Implementation: Working prototypes
>
> Release status: Public preview

The contract-review phase is complete. After the documentation baseline is committed, implementation
begins with Store and follows the accepted roadmap. Existing source and tests remain prototype
evidence, not automatic compatibility requirements. Issues remain open for feedback; pull requests
are disabled until the contribution workflow reopens.

## Products and supporting foundations

| Package               | What it provides                                                                  |
| --------------------- | --------------------------------------------------------------------------------- |
| `@picodash/store`     | Typed values, atomic validation, scoped metadata, persistence, and adapters.      |
| `@picodash/dashpanel` | A movable Panel shell with configurable docking and durable layout.               |
| `@picodash/dashlist`  | Ordered, groupable Dashlet composition with typed bindings and durable ordering.  |
| `@picodash/picodash`  | The integrated facade for applications that need DashPanel and DashList together. |
| `@picodash/ui`        | Shared theme, density, tokens, and generic accessible UI primitives.              |

Store, DashPanel, and DashList are planned as loosely independent products. UI is their shared
presentation foundation, not a fourth product. Store and UI are dogfooded by the two UI products;
Picodash integration follows after all three products are stable.

## Start with the contract

- [Product value propositions](docs/product/value-propositions.md)
- [Contract-led roadmap](docs/ROADMAP.md)
- [Store architecture decision](docs/adr/0002-provider-level-store-and-scoped-views.md)
- [Shared UI architecture decision](docs/adr/0003-shared-ui-foundation.md)
- [Store target API](docs/reference/store.md)
- [Shared UI target reference](docs/reference/ui.md)
- [DashPanel target reference](docs/reference/dashpanel.md)
- [DashList target reference](docs/reference/dashlist.md)
- [Picodash target reference](docs/reference/picodash.md)
- [Component catalog target reference](docs/reference/catalog.md)
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

`PicodashThemeProvider` resolves color theme and density, while `PicodashOverlayProvider` supplies
portal and layer defaults to detached UI primitives. Product Providers compose these independent,
Store-free UI contexts and detached roots repeat their resolved theme and density.

Color theme and density are separate axes: `light | dark | system | CustomTheme` and
`regular | compact`. The Picodash stylesheet aggregates the owning foundation styles once; it does
not add integrated theme names or publish the website's example themes.

DashList exports `useDashListActions(scopeId?)` plus standard action-menu items for expand,
collapse, and the two reset domains. Standalone headers and Picodash menus compose those same
exports; DashPanel does not copy List behavior. Headless execution distinguishes a command that did
not run from an executed Store transaction result.

Picodash reexports the initial DashList-owned ready-made Dashlets without facade wrappers and owns
no additional component family at launch. Future dependency-heavy families use separate optional
packages rather than enlarging the core facade dependency contract.

Its optional document actions export or import one current-scope JSON document through Store-owned
plans. DashList owns the browser dialog, clipboard, and file workflow. Initial Picodash reuses that
primary-List workflow without implicitly aggregating additional Lists; any future multi-target
document UI requires a separate Picodash contract.

## Workspace

- `packages/store`: framework-independent Store prototype.
- `packages/ui`: shared theme, density, token, and generic accessible UI foundation.
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
