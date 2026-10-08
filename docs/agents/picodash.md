# Picodash integration agent instructions

Read this file before changing the facade or behavior that coordinates products. Then read
[`../reference/picodash.md`](../reference/picodash.md) and the agent instructions for Nexus, UI,
DashPanel, and DashStack.

## Decision lens

Picodash combines the independently useful products into one coherent control and monitoring
interface. Integrate stable public contracts; do not hide foundation gaps behind facade wrappers,
private imports, copied components, or a monolithic Dashboard abstraction.

## Integration constraints

- `PicodashProvider` is the initially facade-owned React component. Reexport canonical foundation
  components and types explicitly rather than wrapping or aliasing them.
- Use narrow foundation-owned integration entries. Release integration leases before the composed
  DashPanel Provider host lease.
- Treat the same-scope Stack as a Panel's primary Stack. Additional Stacks require explicit child
  scopes and do not alter or aggregate the primary default action target.
- Compose DashStack actions into the Panel action seam without turning that seam into a registry,
  plugin API, persistence channel, or private controller.
- Keep rail allocation that necessarily coordinates Panel placement and Stack presentation in
  Picodash, and keep it transient.
- Aggregate package-owned catalogs without copying entries or inventing a runtime registry.
- Picodash owns no duplicate Dashlet family, theme recipe, Nexus behavior, or implicit multi-Stack
  document/reset operation.

Integration tests prove composition and lease ordering without repeating Nexus, DashPanel, or
DashStack matrices. Add Contract Lab coverage only for a cohesive browser seam that cannot be owned
more cheaply below the facade.
