# `@picodash/dashpanel`

DashPanel is a standalone React panel shell for applications that need movable, dockable,
dismissible tools or inspectors without building placement, portal, focus, and persistence behavior
from scratch.

## Status

> Contract: Accepted
>
> Implementation: Prototype

The accepted target covers exact package-native composition, responsive geometry, keyboard
placement, focus restoration, adaptive drawer/sheet presentation, action ownership, configurable
dock positions, and collision-safe same-edge allocation. The current package remains prototype
evidence until reconciled. Do not treat existing exports as the final API.

## Product boundary

DashPanel owns:

- the `DashPanelProvider` host and declarative Panel lifecycle;
- floating, snapped, docked, fixed, and hybrid placement behavior;
- configurable dock-position policy, occupancy, and runtime edge allocation;
- viewport or element boundaries, portals, stacking, and focus restoration;
- accessible Panel actions and transient visibility/activation;
- Store-backed durable layout overrides.

It renders arbitrary React children and does not own DashList, Dashlets, application values, routing,
or permanent component removal. The target model requires a Provider with one explicit root Store;
Panels receive scoped `@picodash/store` views through that Provider rather than accepting
independent roots.

The target exposes `DashPanelProvider`, `DashPanel`, `DashPanelTrigger`, the explicit
`DashPanelLauncher`, `useDashPanel`, and Panel-owned action composition. Close changes transient
visibility; confirmed `onRequestRemove` lets the application unmount its JSX. It exposes no mutable
Provider runtime, generic Panel selector, Motion-specific props, or `/advanced` surface.

Panel width has one input with two scopes: the inherited `--picodash-panel-width` token supplies a
host or selector default, and the `width` prop overrides it for one Panel. Intrinsic CSS widths such
as `fit-content` are supported within the effective boundary. Resolved width is never persisted,
and direct `style.width`/`style.inlineSize` are reserved to prevent competing authorities.

Drawer and sheet are explicit host-selected transient modal presentations. They preserve the same
desktop layout, require a visible Close affordance and full modal focus/dismissal behavior, and do
not create automatic responsive breakpoints.

The target package consumes `@picodash/ui` for theme, density, overlay context, semantic tokens,
generic accessible chrome, and the presentational `DashHeader`. Its Product Provider composes the
shared theme and overlay Providers; detached UI roots inherit portal/layer defaults and repeat their
resolved theme and density. DashPanel retains every Panel-specific behavior placed inside that
header, including drag initiation, collapse, placement actions, and close. The current
`@picodash/theme` dependency and inline header are prototype evidence pending migration.

DashPanel may reexport generic UI menu primitives but does not own DashList behavior actions.
Integrated menus compose DashList's headless controller, named menu-item exports, and standalone
scope-document actions directly without reinterpreting their execution results. Cross-List document
aggregation remains Picodash-owned. In the target architecture, modal confirmation primitives come
from `@picodash/ui`; the package-local AlertDialog copy is prototype evidence.

Read the [DashPanel target reference](../../docs/reference/dashpanel.md), including its
[CSS design-token inventory](../../docs/reference/dashpanel.md#theme-and-css-design-tokens),
[shared UI target reference](../../docs/reference/ui.md),
[Store target reference](../../docs/reference/store.md), and
[roadmap](../../docs/ROADMAP.md) before changing the prototype.

The accepted package surfaces are `@picodash/dashpanel`,
`@picodash/dashpanel/integration`, `@picodash/dashpanel/catalog`, and
`@picodash/dashpanel/style.css`. There is no target `/advanced` or `/ui` entrypoint. See the
[component catalog reference](../../docs/reference/catalog.md) for the static discovery schema.

## Verification

```bash
bun run --filter @picodash/dashpanel check
bun run --filter @picodash/dashpanel release:check
```
