# `@picodash/dashpanel`

DashPanel is a standalone React panel shell for applications that need movable, dockable,
dismissible tools or inspectors without building placement, portal, focus, and persistence behavior
from scratch.

## Status

> Contract: Draft
>
> Implementation: Prototype

The reviewed provisional target now covers public package-native composition, responsive geometry, keyboard
placement, focus restoration, action ownership, configurable dock positions, and collision-safe
same-edge allocation. The current package remains reference evidence until its exact prop/type
inventory and CSS token consumption are reconciled. Do not treat existing exports as the final API.

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
Panels receive scoped Store views through that Provider rather than accepting independent roots.

Read the [DashPanel target reference](../../docs/reference/dashpanel.md), including its
[CSS design-token inventory](../../docs/reference/dashpanel.md#theme-and-css-design-tokens),
[Store target reference](../../docs/reference/store.md), and
[roadmap](../../docs/ROADMAP.md) before changing the prototype.

## Verification

```bash
bun run --filter @picodash/dashpanel check
bun run --filter @picodash/dashpanel release:check
```
