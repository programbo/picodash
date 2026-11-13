# Picodash integration facade

`@picodash/picodash` composes Nexus, UI, DashPanel and DashStack. Its root explicitly reexports selected foundation APIs;
`/ui` exposes the selected unbound controls. Import `/style.css` once for the combined product styles.
[The generated inventory](api/picodash.md) records the actual facade surface, which differs from importing every foundation export.

Create one Nexus for the application's lifetime. Supply it to `PicodashProvider`, then compose `DashPanel`, `DashStack`,
`DashGroup` and Dashlets through JSX. Applications retain routing, authorization, transport and which tools are mounted.
For a standalone Stack use `nexus` directly and omit the facade Provider.

Detachable groups retain one React editor tree while moving its portal host between the original Stack and a temporary Panel.
Bindings and logical membership stay with the Stack. Responsive fallback returns the group to its original host.
Recorded group shortcuts are contextual to the original Panel and use committed Nexus preference text.

See [consumer recipes](../development/consumer-recipes.md), [local installation](../development/local-packages.md),
and the [Nexus ownership audit](../design/nexus-api-audit.md).
Source: [`src`](../../packages/picodash/src). Executable consumer examples: [`tests/dogfood`](../../packages/picodash/tests/dogfood).
