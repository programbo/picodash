# Picodash

Picodash provides typed application state and React controls for settings, inspectors, and dashboards.
The workspace currently contains six packages at version `0.0.0`.

| Package                | Implemented role                                                                     | Reference                                          |
| ---------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `@picodash/nexus`      | Typed JSON values, validation, adapters, drafts, metadata, persistence and documents | [Nexus](docs/reference/nexus.md)                   |
| `@picodash/ui`         | Shared theme, density, overlays and accessible presentation                          | [UI](docs/reference/ui.md)                         |
| `@picodash/dashpanel`  | Movable, resizable, dockable React Panels                                            | [DashPanel](docs/reference/dashpanel.md)           |
| `@picodash/dashstack`  | Ordered, groupable Dashlets and bound controls                                       | [DashStack](docs/reference/dashstack.md)           |
| `@picodash/picodash`   | Integration facade, including detachable groups                                      | [Picodash](docs/reference/picodash.md)             |
| `@picodash/dev-bridge` | Private development relay, browser connector, client and CLI                         | [Dev Bridge](docs/development/agent-dev-bridge.md) |

Start with [the documentation index](docs/index.md). The [Nexus design audit](docs/design/nexus-api-audit.md)
distinguishes current behavior from proposed changes to make Nexus consumer-neutral.
The [consolidation record](docs/internal/consolidation-audit.md) records source revisions and verification.

```sh
bun install --frozen-lockfile
bun run port:reserve
bun run lab
```

The Lab opens `/lab`; **Contract tools** opens its test harness. `bun run web` runs the evaluation website.
Use the allocated port printed into `.env.local`; stop one app before starting another in the same worktree.
See [development](docs/development/index.md), [local packages](docs/development/local-packages.md), and [testing](TESTING.md).

The previous documentation and READMEs are [archived with revision and byte-level provenance](docs/archive/2026-11-13/README.md).
Current reference pages describe implemented code. They do not carry forward historical completion percentages or release claims.
