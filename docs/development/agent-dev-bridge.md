# Dev Bridge: implemented inspection APIs

The package is currently named `@picodash/dev-bridge` in code. It exposes a Node loopback relay and client, a browser connector,
a CLI and a host launcher. [The generated API](../reference/api/dev-bridge.md) lists all public entrypoints, options and result types.
The combined protocol version is **4**, with WebSocket subprotocol `picodash.dev-bridge.v4`.

## Authority and lifetime

Start `startPicodashDevBridgeRelay({ allowedBrowserOrigins })` on Node. It returns an agent credential and an origin-bound browser-credential
issuer. Pass the browser credential to `connectPicodashDevBridge` from `/browser`, together with an existing Nexus, a registration ID,
explicit disclosure and a write allowlist. The browser connector is refused in production. Do not ship credentials in application source.

The relay authenticates agent HTTP requests and browser registration. It binds to loopback, validates origin and exact protocol shapes,
fences generations and sequences, limits request sizes, redacts errors, and times out incomplete commands.
Disconnect the connector and close the relay when the owner ends. Reconnecting produces a new fenced generation.

## Three observation channels

| Channel            | What it exposes                                                                     | Authority                                        |
| ------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------ |
| Nexus snapshot     | Allowlisted field values, selected scope metadata/interaction, optional diagnostics | Reads public Nexus state                         |
| Named observations | Application-owned strict JSON results from `getSnapshot` and `subscribe`            | Read-only; explicit `observationNames` allowlist |
| Interaction events | Disclosed scopes and event types with bounded history and cursor                    | Read-only; generation-fenced event stream        |

Named observations are generic enough for any application: solver status, job progress or a derived readout need not become canonical Nexus state.
The connector subscribes before its first observation read and unsubscribes on disconnect. Unavailable, cyclic, oversized or invalid results
are redacted to an unavailable observation instead of exposing arbitrary runtime objects. An observation is not a write target or second state authority.
`observation_equals` can wait for a named JSON value, including a settled revision used to correlate a result with a request.

`createPicodashDevBridgeClient(credential)` exposes `listSessions`, `inspect`, `setValues`, `wait` and `readEvents`.
Writes go through Nexus transactions and the writable-field allowlist. `wait` checks declared conditions against observed snapshots.
`readEvents` has an independent cursor; a history gap is reported explicitly rather than silently claiming complete delivery.
Events and observations coexist in the same v4 session.

## HTTP and CLI

The relay exposes authenticated `/v1/sessions` and generation-scoped inspect/command/event routes.
Use the typed client unless implementing a transport consumer; [relay.ts](../../packages/dev-bridge/src/relay.ts) owns exact routing.
The `picodash-dev-bridge` CLI supports discovery, inspection, allowlisted writes, waits and event reads.
Run its `--help` for the installed flags; the host launcher manages credentials and browser discovery files.
The Lab's `.picodash/dev-bridge.json` is local discovery data, never a tracked secret.

There is no public eval, arbitrary function invocation or application-object reflection endpoint.
Generic local Nexus subscriptions remain useful without this development adapter. The [Nexus audit](../design/nexus-api-audit.md)
separates generic state observation from consumer semantics and transport inspection.
