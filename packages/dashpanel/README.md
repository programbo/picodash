# `@picodash/dashpanel`

DashPanel is a standalone React panel shell for applications that need movable, dockable,
dismissible tools or inspectors without building placement, portal, focus, and persistence behavior
from scratch.

## Status

> Contract: Draft
>
> Implementation: Prototype

The current package is reference evidence while the public naming, responsive behavior, keyboard
placement, focus restoration, action ownership, and theme contract are completed. Do not treat its
existing exports as the final API.

## Product boundary

DashPanel owns:

- the Provider host and Panel lifecycle;
- floating, snapped, docked, fixed, and hybrid placement behavior;
- viewport or element boundaries, portals, stacking, and focus restoration;
- accessible Panel actions and transient visibility/activation;
- Store-backed durable layout overrides.

It renders arbitrary React children and does not own DashList, Dashlets, application values, routing,
or permanent component removal. The target model requires a Provider with one explicit root Store;
Panels receive scoped Store views through that Provider rather than accepting independent roots.

Read the [DashPanel target reference](../../docs/reference/dashpanel.md),
[Store target reference](../../docs/reference/store.md), and
[roadmap](../../docs/ROADMAP.md) before changing the prototype.

## Verification

```bash
bun run --filter @picodash/dashpanel check
bun run --filter @picodash/dashpanel release:check
```
