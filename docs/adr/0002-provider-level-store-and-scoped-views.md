# ADR 0002: Provider-level Store and scoped views

## Status

Accepted target contract. The current implementation remains a prototype until its behavior is
reconciled with this decision and linked from the conformance matrix.

## Context

DashPanel, DashList, and Picodash must be useful as separate products without creating incompatible
state models:

- DashPanel needs durable placement and layout metadata plus transient host coordination.
- DashList needs canonical values, bindings, groups, order, and collapse metadata.
- Picodash needs both products to share one coherent value authority and scope graph.
- Applications may let Picodash own values or connect an existing application store.

The prototype evolved around per-Panel Stores, a private Provider store, and separate Panel/List
identities. Sharing one prototype Store across several entities creates registry and persistence
collisions. Giving every Panel an independent public Store would also make Provider-level
coordination and integrated composition harder to explain.

## Decision

`@picodash/store` provides one explicit root Store that may be Provider-level by default or shared
at application level by choice. The root owns canonical field contracts and values. It also owns
durable scope metadata, structural registration facts, persistence, documents, and diagnostics.

`root.scope(scopeId)` returns an immutable view of that root:

- the view exposes every root field and canonical value;
- its local snapshot exposes only its own durable metadata and binding interaction state;
- writes are attributed to the scope but are not access-restricted by it;
- calling `scope()` on any view resolves through the same root;
- canonical view identity is maintained while a view remains live through a weak cache.

Scope IDs are opaque, root-global, case-sensitive strings. Parent-child scope relationships are
active declarative facts registered by nested scope boundaries. They are not encoded in strings or
persisted as historical ancestry.

## Product composition

`DashPanelProvider` requires an explicit root Store and is the standalone public host for
DashPanel. Integrated `PicodashProvider` composes the same boundary contract. A Provider is a hard
Store and scope-ancestry boundary. It owns transient visual runtime such as portals, resolved
boundaries, visibility, activation, and z-order.

DashPanel does not accept an independent public Store. It resolves a scoped view from its Provider
using its `id`.

A standalone DashList accepts a root or scoped Store. Its `id` and supplied scope must agree. Under
a Provider or another Store context, DashList normally receives only an `id`; an id-less primary
DashList may inherit the nearest scope. DashList supplies the resolved scoped context to its
descendants.

Any DashPanel or DashList that changes the nearest scope registers a parent-child relationship.
Resolving the same scope creates no edge. One active DashPanel and one active DashList may share a
scope; duplicate active entities of the same kind are contract errors.

## State ownership

The root Store owns:

- immutable field definitions and nominally root-owned handles;
- complete canonical JSON values;
- synchronous parsing, validation, and atomic transactions;
- durable Panel layout, DashList order, and collapse overrides;
- active registration indexes and scope relationships;
- Store-owned persistence or one root external-value adapter;
- import, export, diagnostics, and recovery state.

Store defines the validated JSON persistence records for built-in Panel and List metadata without
importing either UI package. The UI packages retain ownership of public placement, component, and
behavior types and translate through the versioned Store integration surface. Arbitrary runtime
metadata extensions are outside the alpha contract.

Scoped views additionally expose binding-level drafts, touched state, input issues, and stale-draft
conflicts for their own scope. These interaction records are ephemeral.

Providers own transient host facts. Components own pointer frames, drag previews, hover visuals, and
other high-frequency rendering state. Only settled placement and ordering operations commit durable
Store metadata.

## Value authority and persistence

Store configuration declares an immutable `valueOwner`:

- `store`: Picodash owns canonical values and persists them subject to field persistence policy.
- `external`: one synchronous root adapter owns canonical values; Picodash persists only its
  metadata.

An adapter projects exactly the Picodash field record and provides synchronous snapshot,
subscription, and atomic whole-record writes. Async or remote durability remains outside the core
Store authority.

Persistence uses one versioned root envelope with stable Store identity, application schema
version, revision, and writer identity. Conflicts never silently use last-write-wins. Export and
persistence disclosure policies are separate.

## React and package boundaries

`@picodash/store` remains framework-independent. `@picodash/store/react` owns the shared context,
hooks, and selector behavior used by both UI products. DashPanel and DashList consume the same peer
Store package; neither UI package depends on the other. `@picodash/picodash` is the integrated
facade.

The public contextual hooks distinguish root and scoped Stores rather than pretending their state
surfaces are identical. Selectors use `Object.is` by default and may opt into shallow or custom
equality.

## Consequences

- Store is independently useful and can be dogfooded before the UI products stabilize.
- DashPanel and DashList remain loosely independent consumers of one shared state contract.
- A scope organizes durable metadata and operation attribution but is not an authorization boundary.
- Passing any scoped Store to code grants access to the entire trusted root value set.
- Multiple Providers may share a root only with unique Provider IDs and disjoint active scopes.
- Provider-local visual runtime remains separate from durable Store state.
- Public API names recorded by the accepted Store target reference change only through explicit
  contract revision; internal implementation symbols remain free to evolve.

## Rejected alternatives

- **One independent public Store per DashPanel:** fragments Provider coordination and integrated
  value ownership.
- **Scope-prefixed field keys:** couples canonical application identity to presentation structure and
  complicates field reuse.
- **Mutable scoped wrappers:** makes nested `scope()` calls change unrelated consumers.
- **Scope-local value copies:** contradicts root-owned canonical fields and creates synchronization
  problems.
- **Provider IDs as scope namespaces:** prevents scopes from moving between hosts and creates two
  identity systems.
- **Persisted scope ancestry:** makes runtime JSX composition disagree with old stored relationships.
- **Async core authority:** introduces hydration races and non-deterministic rendering.
- **Imperative Panel deregistration:** conflicts with declarative entity and relationship leases.

## Detailed record

The searchable decision inventory is
[Store contract decisions](../reference/store-contract-decisions.md).
