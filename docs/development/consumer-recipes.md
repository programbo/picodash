# Consumer recipes

Use [the executable Controls fixture](../../packages/picodash/tests/dogfood/Controls.tsx) for a typed Nexus, a standalone Stack,
a bound control and a subscribed application readout. It is exercised by the package's consumer tests.
Create one Nexus for the application lifetime. Labels and React keys do not substitute for explicit Stack, Group and Dashlet IDs.
Custom wrappers forward the same declared ID to their one returned Dashlet or Group.

For integrated tools, supply the root to `PicodashProvider`, then render a `DashPanel` containing a `DashStack`.
For unbound controls, import from `@picodash/dashstack/ui` or the selected facade `/ui` surface and keep values in the application.
The [Nexus reference](../reference/nexus.md) describes external-store adapters when another synchronous store already owns values.

[ContextualShortcuts.tsx](../../packages/picodash/tests/dogfood/ContextualShortcuts.tsx) exercises detachable groups and recorded shortcuts.
[Controls.tsx](../../packages/picodash/tests/dogfood/Controls.tsx) and its owning tests are the source of truth for working imports.
Import the product stylesheet once. Next.js hosts need a client boundary and a global style import; the public React API is framework-neutral.
