# Agent Dev Bridge

The Agent Dev Bridge is a local development adapter for the public `@picodash/nexus` API. It gives
an agent a narrow, authenticated view of explicitly disclosed Contract Lab state: discover a
session, inspect values/scopes/diagnostics, set allowlisted values, wait for a value or sequence
change, and read explicitly disclosed interaction events. It does not expose an arbitrary Nexus
debugger and must never run in production.

> Contract: Revised for read-only event observation and protocol v3
> Implementation: Verified for the protocol-v3 event extension; existing inspect/write/wait evidence is tracked
> separately in the [conformance matrix](../reference/contract-conformance.md#agent-dev-bridge).

## Quickstart with Contract Lab

Browser hosts pass an `AbortSignal` to `connectPicodashDevBridge` and abort it before destroying
their Nexus. Aborting cancels pending registration or closes an established connection; late
socket frames are ignored. Pending registration rejects with `AbortError`. A resolved connection
also exposes `close()` for explicit teardown. The Contract Lab ties this signal to effect cleanup.

From the repository root:

```bash
bun run port:reserve
bun run lab
```

Wait until the Lab host writes `.picodash/dev-bridge.json`. The file is private (`0600`),
gitignored, and contains the agent URL and bearer token. The relay and browser-credential broker
use ephemeral loopback ports; the Lab web server uses its Hermes-reserved fixed port.

Load the two values into the environment without placing the token in argv or shell history. This
example reads the file in short-lived Node processes and exports only the resulting environment
variables:

```bash
export PICODASH_DEV_BRIDGE_URL="$(node -e 'const fs=require("fs"); const c=JSON.parse(fs.readFileSync(".picodash/dev-bridge.json","utf8")); process.stdout.write(c.url)')"
export PICODASH_DEV_BRIDGE_TOKEN="$(node -e 'const fs=require("fs"); const c=JSON.parse(fs.readFileSync(".picodash/dev-bridge.json","utf8")); process.stdout.write(c.token)')"
bun run --filter @picodash/dev-bridge build
```

Use the built CLI with `node packages/dev-bridge/dist/cli.mjs`. It reads only
`PICODASH_DEV_BRIDGE_URL` and `PICODASH_DEV_BRIDGE_TOKEN`; it never accepts credentials as flags.

### Discover sessions

```bash
node packages/dev-bridge/dist/cli.mjs sessions
```

The JSON output includes `sessionId`, `generation`, `sequence`, disclosure/write allowlists, and
the capabilities `inspect`, `set_values`, `wait`, and `read_events`. Event disclosure is listed
separately as `disclosedEventScopeIds`, `disclosedEventTypes`, and `eventSequence`. Select a current
session and keep both its
`sessionId` and `generation` together. A browser reload keeps the session ID but increments its
generation; rediscover before retrying and do not mutate with a stale reference.

Discovery confirms registration, not snapshot readiness. `inspect` may return
`session_unsynchronized` until the first disclosed snapshot or a resynchronization completes.
Consumers requiring state wait for a successful `inspect`, rather than treating registration
existence as readiness; other error codes retain their normal failure meaning.

### Inspect disclosed state

```bash
node packages/dev-bridge/dist/cli.mjs inspect \
  --session-id SESSION_ID --generation 1
```

### Set disclosed, writable values

The command body is JSON on stdin. This changes only fields the browser registration explicitly
made writable (the Contract Lab specimen uses `specimenMetric`):

```bash
printf '%s\n' '{"values":{"specimenMetric":42}}' |
  node packages/dev-bridge/dist/cli.mjs set-values \
    --session-id SESSION_ID --generation 1
```

The response distinguishes a successful transaction from a Nexus rejection or contract error.
The bridge does not bypass Nexus validation.

### Wait for a change

Wait for a value to equal `42`, requiring a sequence newer than `7`:

```bash
printf '%s\n' '{"timeoutMs":1000,"condition":{"type":"value_equals","field":"specimenMetric","value":42,"afterSequence":7}}' |
  node packages/dev-bridge/dist/cli.mjs wait \
    --session-id SESSION_ID --generation 1
```

The other condition is `{"type":"sequence_after","sequence":7}`. A wait returns
`outcome: "satisfied"` or `"timed_out"`; Ctrl-C aborts it.

### Read disclosed interaction events

Protocol v3 uses the `picodash.dev-bridge.v3` WebSocket subprotocol. This is a clean pre-v1
cutover; version-2 peers cannot silently accept the changed registration and command contract.
Event observation adds no mutation or publication authority.

Browser registration independently opts in with `disclosure.eventScopeIds` and
`disclosure.eventTypes`. Both default to empty arrays. An event must match both lists; disclosing a
metadata `scopeId` does not disclose its events, and disclosing events does not reveal its values
or metadata. Use the Nexus event `type` names, for example `hover`, `pointer`, `drag.start`,
`drag.update`, `drag.end`, `drag.cancel`, `command`, and `layout`.

Establish a current baseline before performing the UI interaction:

```bash
printf '%s\n' '{}' |
  node packages/dev-bridge/dist/cli.mjs events \
    --session-id SESSION_ID --generation 1
```

An omitted cursor returns no historical events and supplies the current cursor. Retain that exact
`{ sessionId, generation, sequence }` cursor, perform the public UI action, then pass it back in the
next request. This sequence is a relay-owned event ordinal, distinct from the snapshot sequence and
the root Nexus event sequence inside each event:

```json
{
  "cursor": { "sessionId": "SESSION_ID", "generation": 1, "sequence": 7 },
  "limit": 256,
  "timeoutMs": 1000
}
```

Send the JSON on stdin to the same `events` command. `limit` is 1–256 and defaults to 256;
`timeoutMs` is 0–30000 and defaults to 0. A positive timeout waits for events newer than a supplied
cursor; establishing a baseline is immediate. A zero-timeout read may return an empty `available`
result.
Responses distinguish `available`, `timed_out`, and `history_gap`, return entries shaped
`{ sequence, event: NexusInteractionEvent }`, and include the next cursor and
`earliestAvailableSequence`. Advance to the last returned cursor; do not infer contiguity from root
Nexus event sequence gaps because disclosure deliberately filters events.

The typed client exposes `readEvents(session, command, { signal? })`, where `command.type` is
`read_events` and the command includes a `requestId` plus the same cursor/limit/timeout fields.
Abort a pending read through its signal or Ctrl-C in the CLI.

The relay retains at most 256 disclosed events or 1 MiB per session; each validated event is at
most 4 KiB. Motion updates may coalesce for slower consumers. Lifecycle boundaries must not be
silently lost: an expired cursor reports `history_gap` with empty events and a current cursor rather
than pretending the remaining history is complete. Explicitly accept that new cursor or establish
a new baseline after handling the gap. At most 32 event waits may be pending per session. Invalid,
out-of-order, or undisclosed browser events fail closed; transport overflow closes the owned
connection and unsubscribes instead of retaining an unbounded queue. Reload increments
the session generation and invalidates old cursors. Rediscover and establish a fresh baseline;
do not replay a stale generation. The Lab timeline is only a separate bounded local display.

## Exit meanings

- `0`: command completed; a wait was satisfied and a set-values transaction was accepted.
- `2`: usage, credential configuration, or stdin JSON/schema error.
- `3`: transport, protocol, or local internal failure.
- `4`: bridge error such as unauthorized, unavailable session, stale generation, unsynchronized
  browser, denied capability, or an event history gap.
- `5`: Nexus set-values contract error or rejected transaction.
- `6`: value/sequence wait or event read timed out.
- `130`: wait interrupted with Ctrl-C.

JSON responses are written to stdout; local CLI errors are redacted and written to stderr.

## Security and lifecycle

The dev host creates `.picodash` as `0700`, writes `dev-bridge.json` and its lock as `0600`, and
removes owned files on clean shutdown or child exit. It refuses a live lock and safely recovers a
stale lock. If a process was killed, remove only the stale `.picodash/dev-bridge.lock` after
confirming the recorded PID is no longer live, then restart `bun run lab`; do not reuse a stale
credential. Cleanup is ownership-checked and will not remove a replacement file.

The browser receives a separate, origin-bound, single-use credential from the Lab's local broker.
The agent bearer token is never passed to the browser child or printed in logs. Disclosure and
writable allowlists are enforced at registration and again on every relay/browser command. The
relay is loopback-only, rejects non-allowlisted origins, and is disabled in production builds.

When the browser reconnects after reload, the relay increments the session generation and rejects
old references. Always run `sessions` again; never retry a mutation using the old generation.

Stop the Lab with Ctrl-C so the host can close the broker/relay and remove owned credentials. If
the Lab is already stopped, a new start performs stale-lock recovery as described above.

## Scope and roadmap

Protocol-v3 event observation passes package/protocol/CLI/artifact checks and real Panel/List
browser-consumer proof within the complete 18-test Lab gate. See the event rows in the conformance
matrix rather than treating the earlier snapshot journey below as event verification.

Implemented baseline: Nexus relay, browser connector, typed HTTP client, CLI, and Contract Lab
dogfood (discover, inspect, set, wait, and reload-generation rejection). The same journey now proves
Bridge writes through single and compound DashList bindings, UI input observed by Bridge, stale
draft behavior after an external write, confirmed DashList-owned overwrite observed through
inspect/wait, identified Nexus migration with a projected disclosed value, quarantined metadata
diagnostics, public metadata replacement, and a live Nexus session retained while DashPanel hides
and reopens. The same browser journey also creates and executes a value-free Nexus document export
plan, mutates the disclosed metric through Bridge, then analyzes and imports the captured document
locally; browser state and Bridge inspect/wait confirm restoration without exposing document
contents or adding Bridge authority. No Bridge extension was needed: focus, visibility, and
activation remain Provider-owned browser behavior rather than agent protocol authority; raw
quarantine payloads stay undisclosed.

The Contract Lab composition preset also mounts an independent, narrowly writable Style Lab
registration: `registrationId: "dashlet-style-lab"`, label `Contract Lab Style Lab`, disclosure of
only `switchValue` and `number` with no scopes or diagnostics, and a write allowlist containing only
`number`. Its browser journey selects this session by registration ID and browser tab ID. It first
proves that an untouched formatted Number blur leaves the canonical `1.234567` unchanged. It then
uses the one allowlisted Number write to make the focused Number presentation incompatible, proving
editor removal, shell focus repair, and one warning announcement. The same journey toggles the
public `SwitchDashlet` in the UI and proves the canonical boolean through `wait` and `inspect` while
the primary specimen session stays unchanged. `switchValue` remains non-writable through Bridge;
the registration discloses no other value, scope, or diagnostic authority.

After proving that isolation, the same journey performs one public UI-to-Bridge metadata
correlation on the primary `contract-lab-specimen` registration. It collapses `Standalone group`
through its accessible disclosure control, waits for the primary session sequence to advance,
rediscovers the current generation, and inspects the already disclosed
`contract-lab-standalone-list` scope for the durable `standalone-group` collapse override. The
journey does not write metadata through Bridge or expand disclosure. Deterministic collapse,
reorder, and reset behavior remains owned by the focused DashList and Nexus tests.

MCP stdio parity is a follow-on only if the CLI proves useful. Bridge persistence, reset, and other
dangerous extensions remain deferred; they require preview, explicit confirmation, idempotency, and
an audit trail before implementation. Nexus document import/export remains a browser-local
consumer capability; document contents are not added to the Bridge protocol.

Background and tracking: [Picodash issue #80](https://github.com/programbo/picodash/issues/80).
