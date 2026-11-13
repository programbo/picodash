# DashStack: implemented behavior

The current package is `@picodash/dashstack`; DashList is the historical name.
A standalone `DashStack id="settings" nexus={root}` needs no Panel. Import `/style.css` once.
The [complete export inventory](api/dashstack.md) covers the root, `/integration`, `/ui`, `/catalog`, and `/charts` entrypoints.

`DashStack`, `DashGroup` and `Dashlet` compose ordered application content. Declarations require stable IDs, including custom wrappers.
Groups support nesting, collapse, ordering and, through Picodash integration, detachment. Root and group order preferences are durable;
active drag transforms and pointer state are ephemeral. Pinned lanes participate in responsive overflow behavior.

Bound Dashlets use root-owned fields. Input bindings retain invalid drafts and issues without overwriting canonical values.
Display bindings share canonical values. Controls can be disabled or read-only; presentation incompatibility is distinct from Nexus validation.
The root exports ready-made text, number, switch, slider, range, choice, target/result and other retained controls.
`/ui` exposes unbound controls for application-owned composition. `/charts` adapts the optional TanStack Charts peer.
The generated inventory is authoritative about which names are exposed; a catalog entry is a discoverability record rather than another implementation.

## Stack behavior actions

Ordering, collapse, reset, document and prune actions use public Nexus commands and integration leases.
Pointer and keyboard reordering share outcomes and cancellation. Subgroups preserve original identity and ancestry.
Item attention is published by [`item-attention.ts`](../../packages/dashstack/src/item-attention.ts) through source-owned
`focused`, `hovered` and `active` flags currently hosted by Nexus.

There is no implemented orientation override on the root Stack. Current layout is vertical and measured against its own inline size.
A future orientation policy should belong to Stack or an integration adapter, as described in [the audit](../design/nexus-api-audit.md).

Source: [`src/index.tsx`](../../packages/dashstack/src/index.tsx), [`ready-made.tsx`](../../packages/dashstack/src/ready-made.tsx),
[`ui.tsx`](../../packages/dashstack/src/ui.tsx). Executable examples: [consumer fixtures](../../packages/picodash/tests/dogfood).
