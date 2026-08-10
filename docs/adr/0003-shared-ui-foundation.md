# ADR 0003: Shared UI foundation

## Status

Accepted target contract. The former `@picodash/theme` package, duplicated product primitives,
and inline Panel header were prototype evidence; the theme package is now retired by the
pre-release clean replacement.

## Context

DashPanel and DashList are independent products, but both need the same theme resolution, density,
semantic tokens, accessible chrome, and header composition. Making either product depend on the
other would violate their independent package boundaries. Importing source files across sibling
packages would hide that dependency from package manifests and published artifacts.

The integrated `@picodash/picodash` facade sits above both products, so its `/ui` entrypoint cannot
also be the lower-level owner of primitives that those products consume. Keeping
`@picodash/theme` beside a second shared-component package would split ownership of styles, theme
context, and component behavior without providing a useful consumer boundary.

## Decision

The target shared presentation foundation is `@picodash/ui`. It replaces `@picodash/theme` and
owns:

- theme and density types, context, resolution, data attributes, recipes, and semantic tokens;
- independent theme/density and portal/layer Providers that Product Providers may compose without
  introducing a Store dependency;
- shared structural CSS needed by its public components;
- generic accessible chrome and interaction primitives used unchanged by at least two foundational
  products;
- the presentational `DashHeader` composition component.

A component belongs in `@picodash/ui` only when all of these rules hold:

1. DashPanel and DashList both use the same public behavior.
2. Its semantics do not mention Panel, List, Dashlet, Store, scope, placement, ordering, or another
   product concept.
3. Its accessibility, theme, and interaction contract should remain identical for every consumer.
4. It owns no product state, product commands, registration, persistence, or domain policy.

`@picodash/store` has no UI dependency. DashPanel and DashList may each depend on Store and UI, but
not on one another. `@picodash/picodash` depends on the foundations and reexports shared UI where
the facade promises that convenience.

Product-specific UI remains with its product. DashPanel owns placement, drag surfaces, collapse,
close, and Panel actions. DashList owns Dashlets, groups, bindings, ordering, List resets, and
Dashlet-oriented unbound controls. `@picodash/dashlist/ui` therefore remains a product surface; it
is not replaced by the shared package.

The pre-release migration is a clean rename and ownership move. The target does not retain an
`@picodash/theme` compatibility alias or publish two theme authorities.

## Consequences

- UI is a supporting foundation, not a fourth independently marketed product.
- DashPanel-only and DashList-only consumers receive the same theme and shared chrome contracts
  without installing the other product.
- Shared components have an explicit dependency and release boundary instead of cross-package
  source imports.
- Each product explicitly reexports shared components it promises from its own surface; blanket
  reexports are avoided.
- Styles load from the shared UI foundation first, followed by the consuming product stylesheet.
- Theme/density resolution remains separate from portal/layer defaults. Detached overlay roots
  repeat resolved attributes instead of mutating a portal container shared by multiple contexts.
- The migration must reconcile current duplicated primitives and theme imports before UI can be
  marked implemented.

## Rejected alternatives

- **Import DashPanel source from DashList:** creates an undeclared build and publication dependency.
- **Make DashList depend on DashPanel:** breaks the accepted independent-product model.
- **Create a one-component DashHeader package:** adds a public package without a durable ownership
  boundary.
- **Keep theme and shared components in separate foundations:** divides theme-aware UI ownership and
  complicates consumer setup.
- **Use `@picodash/picodash/ui` as the foundation:** inverts the dependency graph by making lower
  products depend on their integrated facade.

## Detailed record

The target surface and admission rules are documented in the
[shared UI target reference](../reference/ui.md).
