# Agent Dev Bridge

The Agent Dev Bridge is a local development adapter for the public `@picodash/nexus` API. It gives
an agent a narrow, authenticated view of explicitly disclosed application state: discover a
session, inspect values/scopes/diagnostics, set allowlisted values, and wait for a value or sequence
change. It does not expose an arbitrary Nexus debugger and must never run in production.

## External development apps

Dogfood .53 and later include an optional private `@picodash/dev-bridge` tarball alongside the five
runtime packages. No registry publication or private-source copying is needed. Use Node 22.12+ and
Bun 1.3.14+ in a standalone React application. The normal installer leaves Bridge out:

```sh
bun /path/to/CURRENT/install.mjs /path/to/app --dev-bridge
```

This adds Bridge to `devDependencies` with a matching Nexus override. Later compatible updates
retain that opt-in. To roll back to a five-package snapshot, use the **current installer**:

```sh
bun /path/to/CURRENT/install.mjs /path/to/app --snapshot /path/to/older-bundle
```

It verifies the older manifest and every tarball hash before mutation and removes only the
bundle-owned Bridge dependency/override. A foreign Bridge installation remains untouched, or
produces an explicit opt-in conflict. Old immutable installers do not understand this cleanup.
Commit the resulting manifest, lockfile and vendor bundle. The host automatically appends narrow
credential/lock/temp patterns to `.picodash/.gitignore`, preserving existing content. Tokens stay
Git-ignored by default; no parent `.gitignore` mutation or remembered manual step is required.

### One command owns the development host

Add an optional script alongside your ordinary development and production-preview scripts:

```json
{
  "scripts": {
    "dev:agent": "picodash-dev-bridge-host --origin http://127.0.0.1:6240 -- bun x --no-install vp dev --host 127.0.0.1 --port 6240 --strictPort"
  }
}
```

Use your application's reserved development port; 6240 is Gearmo's explicit development port.
`bun run dev:agent` starts the loopback relay and ephemeral broker, creates the private
`.picodash/dev-bridge.json`, and owns the direct development child/process group. Ctrl-C, parent
loss, startup failure, child exit and stop converge on awaited cleanup of owned processes,
sockets and files. The command prints only the credential file path. The bearer token never
enters argv, the browser bundle or the child environment. Normal development has no automatic
expiry; public `/host` options allow an explicit `lifetimeMs` when needed. Startup has bounded
child spawn, and shutdown uses TERM then KILL with bounded owned-group exit verification.
Host `finished` resolves only after cleanup. The host refuses production and non-local HTTP origins.

The host supplies `VITE_PICODASH_DEV_BRIDGE_CREDENTIAL_URL` only to that child. Plain `vp dev`
without it stays quiet and disabled. Keep your production preview (Gearmo 6241) unchanged.
Applications with another framework can use `createPicodashDevBridgeHost` from
`@picodash/dev-bridge/host` with `{origin,command:{file,args,cwd},browserCredentialEnv?}`; the Lab
uses the same host with Next-specific argument and `NEXT_PUBLIC_*` plumbing. Host readiness means
the relay/broker and child were started, not that the application has rendered or a solver settled.

### Connect the actual Nexus and read-only application source

Copy the bundled `example/DevBridge.tsx` and its `Controls.tsx` companion for the public import/opt-in call
([source example](../../packages/picodash/tests/dogfood/DevBridge.tsx)). In your application effect, keep
Nexus, disclosure, permissions and the observation source stable. Gate the dynamic import on
`import.meta.env.DEV`; abort before destroying Nexus, including StrictMode/HMR cleanup:

```tsx
useEffect(() => {
  if (!import.meta.env.DEV) return
  const abort = new AbortController()
  let close: (() => Promise<void>) | undefined
  void import('@picodash/dev-bridge/browser')
    .then(async ({ connectPicodashDevBridgeFromBroker }) => {
      if (abort.signal.aborted) return
      const connection = await connectPicodashDevBridgeFromBroker({
        development: import.meta.env.DEV,
        brokerUrl: import.meta.env.VITE_PICODASH_DEV_BRIDGE_CREDENTIAL_URL,
        nexus,
        registrationId: 'my-app',
        label: 'My app',
        buildId: 'development',
        disclosure: {
          valueFields: ['enabled'],
          scopeIds: [],
          diagnostics: false,
          observationNames: ['solver', 'solverSettledRevision', 'panels'],
        },
        permissions: { writableFields: ['enabled'] },
        observations,
        signal: abort.signal,
      })
      if (abort.signal.aborted) await connection.close()
      else close = connection.close
    })
    .catch(() => {
      if (!abort.signal.aborted) console.warn('Development bridge unavailable; details redacted.')
    })
  return () => {
    abort.abort()
    void close?.()
  }
}, [nexus, observations])
```

Replace `enabled` and app identity with your actual allowlist. `development:false` or absent broker
returns `{status:'disabled',close()}` without fetch or WebSocket registration; a live result is
`{status:'connected',session,close()}`. There are no automatic retries. The connector validates the
broker/credential and preserves AbortSignal cancellation during fetch and registration.

`PicodashDevBridgeObservationSource` has public `getSnapshot()` and `subscribe(listener)` methods.
It returns plain named JSON from the application's supported model/controller API. Subscribe
callbacks mean a meaningful observation may have changed; no per-pointer consumer measurements
or forced pointer updates are required. The connector subscribes before its first read, tolerates
synchronous callbacks and suppresses equal snapshots. Unmount/abort/disconnect unsubscribes.
Disclosure names are separate from Nexus value-field permissions. Never persist/mirror solver or
Panel observations into Nexus to make them inspectable.

A minimal source against an application's public solution model looks like this; extend its JSON
projection with requested inputs, actuals and Panels according to your app's disclosure policy:

```ts
import type { PicodashDevBridgeObservationSource } from '@picodash/dev-bridge/browser'

const observations: PicodashDevBridgeObservationSource = {
  getSnapshot() {
    const state = app.solutions.getSnapshot() // stable, application-owned public model
    return {
      solver: { requestRevision: state.id, status: state.status },
      solverSettledRevision: state.status === 'pending' ? null : state.id,
    }
  },
  subscribe(listener) {
    return app.solutions.subscribe(listener)
  },
}
```

Inspect returns each disclosed observation as `{status:'available',value}` or `{status:'unavailable'}`.
Only deliberately named results are read. Missing, throwing, non-JSON, cyclic or oversized source
results become redacted unavailable observations; they do not disconnect Nexus or preserve stale
values as current. A valid later notification restores availability. There are at most 64 names,
24 nested levels, 10,000 visited values per observation, 64k UTF-8 bytes per value and 256k aggregate
observation bytes. Names and build IDs are bounded. The wire accepts no projection expressions,
arbitrary evaluation, filesystem access or application command RPC.

### Correlate solver completion with the accepted request

An application can disclose `solver` with requested inputs/priority, requestRevision, phase,
current solved actuals and candidate identity/count/rank. If retained actuals belong to an older
revision, label them stale explicitly. It can separately disclose `solverSettledRevision`: `null`
while pending, otherwise the current revision when ready, no-fit or error. These meanings belong
to the application; Bridge sequence is not a worker revision or readiness guarantee.

Inspect requested inputs/priority and revision, perform the atomic allowlisted Nexus write, then
inspect the resulting authoritative request revision. Verify `requestedDesign` and `requestedPriority`
still match the intended accepted write before selecting that revision. A superseding application
edit is a different request, even if its solver completes. Wait on the matching terminal revision:

```json
{
  "timeoutMs": 1000,
  "condition": { "type": "observation_equals", "name": "solverSettledRevision", "value": 42 }
}
```

Then inspect phase and actuals. No-fit/error completes the same revision wait without waiting for
ready forever. No-op and presentation-only writes need not increment solver revision: an already
terminal same revision satisfies immediately. Use optional `afterSequence` only when a newer
observation is actually required. Public Panel controllers can supply committed placement and
`dragPreview` in the read-only `panels` projection; the [dock-reactive recipe](dock-reactive-layout.md)
explains overlay behavior while camera transforms stay fixed.

### Select a tab explicitly

`registrationId` is stable application identity; each browser tab has a sessionStorage-owned
`browserTabId`. Relay session IDs are scoped by origin/app/tab; reload reconnects with a new
generation while keeping the same tab/session identity. `buildId`, label, server-bound origin,
disclosure and permissions appear in session descriptors. List sessions, select the exact
registrationId/browserTabId, then retain sessionId/generation together. Do not auto-pick the first
session when several tabs match. Disconnected sessions leave discovery; old references receive
explicit disconnected or stale-generation errors. Rediscover before another mutation.

```sh
picodash-dev-bridge sessions --credential-file .picodash/dev-bridge.json
picodash-dev-bridge inspect --session-id SESSION_ID --generation 1 --credential-file .picodash/dev-bridge.json
```

The CLI reads a private credential file without putting its token in argv. Environment credentials
remain supported. Its normal `set-values`/`wait` JSON stdin and exit meanings below are unchanged;
protocol 3 adds named read-only observations and deliberately fences version 1/2 peers.

### Disclosure recipe

Start with explicit read-only disclosure, then allow individual inputs as needed. This example
exposes two existing Lab fields and one scope, and allows writes only to the metric:

```json
{
  "registrationId": "contract-lab-specimen",
  "disclosure": {
    "valueFields": ["specimenMetric", "specimenUnit"],
    "scopeIds": ["contract-lab-standalone-list"],
    "diagnostics": false
  },
  "permissions": { "writableFields": ["specimenMetric"] }
}
```

Use your own existing field keys, scope IDs, and registration ID with the external host. Begin with `writableFields: []`, then add only intended inputs; writable fields must be
included in `valueFields`. Omitted disclosure lists and permissions default to empty, and diagnostics
defaults to false. Scope disclosure exposes that scope's metadata for inspection; it does not grant
metadata writes. Registration also enumerates Nexus field keys, so hiding a value does not hide the
existence of its field name. Do not treat disclosure as a way to conceal sensitive field names.

Keep disclosure and permission objects stable across React renders. The
[Lab connector](../../apps/lab/src/components/contract-lab/dev-bridge-connector.tsx) owns its connection
through effect cleanup and must reconnect if these inputs change. Its source shows the lifecycle;
it is not an installable consumer component.

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

Use the built CLI with `node packages/dev-bridge/dist/cli.mjs`. It accepts a private path through `--credential-file`, or reads
`PICODASH_DEV_BRIDGE_URL` and `PICODASH_DEV_BRIDGE_TOKEN`; it never accepts a token as a flag.

### Discover sessions

```bash
node packages/dev-bridge/dist/cli.mjs sessions
```

The JSON output includes `sessionId`, `generation`, `sequence`, disclosure/write allowlists, and
the capabilities `inspect`, `set_values`, and `wait`. Select a current session and keep both its
`sessionId` and `generation` together. A browser reload keeps the session ID but increments its
generation; rediscover before retrying and do not mutate with a stale reference.

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

### A Bridge sequence is not solver readiness

A successful `set-values` response means Nexus accepted the transaction. A satisfied
`sequence_after` wait means the Bridge observed a newer disclosed snapshot in that session
generation. The sequence is Bridge-owned, not a worker job ID or a guarantee that every Nexus
transaction produced a new snapshot. Changes outside disclosure may not advance it; disclosed
metadata or diagnostics changes can advance it without a solver result.

Neither result proves that React has painted, that a worker has finished, or that a computed design
matches the latest inputs. A solver result held outside Nexus is not visible through this Bridge.
After a canonical write, wait separately for the application's result readiness and correlate it
with the input revision or job ID. An old `ready` result is insufficient. If an app intentionally
publishes result status and revision into Nexus, it can disclose those fields read-only and wait
for the matching revision and ready state; Bridge does not add that application contract itself.

## Exit meanings

- `0`: command completed; a wait was satisfied and a set-values transaction was accepted.
- `2`: usage, credential configuration, or stdin JSON/schema error.
- `3`: transport, protocol, or local internal failure.
- `4`: bridge error such as unauthorized, unavailable session, stale generation, unsynchronized
  browser, or denied capability.
- `5`: Nexus set-values contract error or rejected transaction.
- `6`: wait timed out.
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

Implemented baseline: Nexus relay, browser connector, typed HTTP client, CLI, and Contract Lab
dogfood (discover, inspect, set, wait, and reload-generation rejection). The same journey now proves
Bridge writes through single and compound DashStack bindings, UI input observed by Bridge, stale
draft behavior after an external write, confirmed DashStack-owned overwrite observed through
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
reorder, and reset behavior remains owned by the focused DashStack and Nexus tests.

MCP stdio parity is a follow-on only if the CLI proves useful. Bridge persistence, reset, and other
dangerous extensions remain deferred; they require preview, explicit confirmation, idempotency, and
an audit trail before implementation. Nexus document import/export remains a browser-local
consumer capability; document contents are not added to the Bridge protocol.

Background and tracking: [Picodash issue #80](https://github.com/programbo/picodash/issues/80).
