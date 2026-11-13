# Documentation

These pages were rebuilt from the consolidated source on 2026-11-13. Package manifests and emitted declarations
identify the public API; source and tests explain its behavior. Version `0.0.0` does not imply API stability.

| Need                                                        | Read                                                                                                                                      |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Understand state ownership and operations                   | [Nexus](reference/nexus.md)                                                                                                               |
| Review consistency, coverage, overlap and consumer coupling | [Nexus API audit](design/nexus-api-audit.md)                                                                                              |
| Find every exported runtime value and TypeScript name       | [Generated public API](reference/api/index.md)                                                                                            |
| Compose Panels, Stacks and custom content                   | [DashPanel](reference/dashpanel.md), [DashStack](reference/dashstack.md), [Picodash](reference/picodash.md)                               |
| Inspect a running application                               | [Dev Bridge](development/agent-dev-bridge.md)                                                                                             |
| Run, test or install a local build                          | [Development](development/index.md), [consumer recipes](development/consumer-recipes.md), [local packages](development/local-packages.md) |
| Check what was integrated and verified                      | [Consolidation record](internal/consolidation-audit.md)                                                                                   |

[Shared UI](reference/ui.md) owns presentation primitives. [Archived documentation](archive/2026-11-13/README.md)
is historical evidence only. Frozen evaluation instructions remain under `evaluations/v1` as executable fixtures.

## Keeping this accurate

After a public source change, build the affected packages, run `bun run docs:generate`, update the owning behavioral reference,
and run `bun run docs:check`. Generated inventories include all manifest entrypoints and distinguish type-only exports.
Declarations can contain supporting internal types; only the entrypoint export table grants public importability.
Record new design decisions separately from implemented behavior. An accepted future direction must not be presented as an existing API.
