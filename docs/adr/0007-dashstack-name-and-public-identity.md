# ADR 0007: DashStack name and public identity

## Status

Accepted.

## Decision

Rename **DashStack** to **DashStack**, published as `@picodash/dashstack`. The name describes its
vertical composition of ordered, groupable Dashlets in normal presentation. Responsive density
and Dashlet label/value orientation do not change that ordering axis. The separately accepted
rail presentation remains a distinct target contract; this rename adds no layout behavior. Dashlet,
DashGroup, DashPanel, Picodash, and Nexus retain their names and ownership.

This is one clean pre-release cutover: package paths, components, types, hooks, action controllers,
catalog identities, CSS hooks, Nexus integration leases, diagnostics, and durable metadata use
DashStack terminology. The reset action is `resetStack`, presented by `DashStackResetStackItem`.
Native list semantics and implementation collections keep their ordinary names.

## Consequences

There is no parallel DashStack API or package alias. Existing consumers must update imports and
product-specific names. The durable metadata key changes from `dashStack` to `dashStack`; older
preview documents and persistence containing that key fail strict validation and follow the
existing invalid-data recovery path. No silent migration or new persistence protocol is added.
References and historical implementation notes use the current paths so their links remain usable.
