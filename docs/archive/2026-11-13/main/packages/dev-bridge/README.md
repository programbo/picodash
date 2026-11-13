# `@picodash/dev-bridge`

`@picodash/dev-bridge` is a development-only, adapter-like consumer of the public
`@picodash/nexus` contract. It lets a local agent discover explicitly disclosed Nexus sessions,
inspect disclosed values/scopes/diagnostics, set allowlisted values, wait for a value or sequence
change, and observe explicitly disclosed interaction events while the Contract Lab is running. It
is not a Nexus extension, application API, or production transport.

> Contract: Revised for protocol v3 and read-only events
> Implementation: Verified for the event extension; broader operations remain separately gated.

## Current surface

- `@picodash/dev-bridge` exports the loopback relay, typed client, and protocol types. The package
  also provides the separate `picodash-dev-bridge` CLI binary.
- `@picodash/dev-bridge/browser` exports the browser connector used by the Contract Lab.
  Its optional abort signal cancels registration and closes the connection during host teardown;
  see the operational guide for ownership and cleanup.
- The relay serves an authenticated HTTP client API and an origin-bound, single-use browser
  credential over the `picodash.dev-bridge.v3` WebSocket subprotocol. Version 3 adds independently
  disclosed event scopes/types and cursor reads. The clean pre-v1 cutover rejects incompatible
  earlier peers rather than silently accepting an incomplete observation contract.
- Browser registrations disclose value fields, scope IDs, and diagnostics explicitly; writable
  fields must be a subset of disclosed value fields.
- Interaction events require separate `eventScopeIds` and `eventTypes` disclosure. Cursor reads
  are read-only, generation-fenced, and bounded; history loss is reported explicitly.

The CLI supports `sessions`, `inspect`, `set-values`, `wait`, and `events`. The exact local setup,
credential handling, and exit codes are in [the operational guide](../../docs/development/agent-dev-bridge.md).
The `events` command accepts cursor/limit/timeout JSON on stdin. Establish a current cursor, perform
the public UI action, then read later events; neither the CLI nor the typed `readEvents` client
publishes events or grants new mutation authority.
The event extension has passing focused package/protocol/CLI tests and artifact checks. Real
Panel/List browser-consumer evidence passes within the complete 18-test Lab gate.

## Development boundary

The relay refuses to start when `NODE_ENV=production`. It binds loopback only, uses ephemeral
ports, keeps agent and browser credentials separate, and writes no credentials to command-line
arguments. The bridge does not add Nexus behavior or change Nexus persistence semantics.

The implemented baseline is Nexus relay/browser/client/CLI plus Contract Lab dogfood. The Lab now
uses the existing inspect/set/wait surface to verify bound Dashlets, retained Panel lifecycle, and
DashList stale-draft overwrite confirmation without exposing transient UI plans through the Bridge.
The same disclosed session now dogfoods an identified Nexus migration, safe quarantined-metadata
diagnostics, and public metadata replacement without exposing raw quarantine payloads. It also
captures a value-free Nexus document export plan, mutates the disclosed metric through Bridge, and
restores the captured document through public Nexus analysis/import while Bridge inspect/wait
observes the result; document contents stay browser-local. That existing evidence does not by
itself verify the protocol-v3 event extension.
Consider MCP stdio parity only if the CLI proves useful. Bridge persistence/reset extensions are
deferred; any future dangerous operation needs preview, confirmation, idempotency, and an audit
trail.

Implementation status and primary verification owners are recorded in the
[contract conformance matrix](../../docs/reference/contract-conformance.md#agent-dev-bridge).
