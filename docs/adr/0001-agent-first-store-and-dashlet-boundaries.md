# Agent-first Store and Dashlet boundaries

Picodash will place the complete state engine for one Panel in `@picodash/store`, with React
selectors and controlled bindings in `@picodash/store/react`. Typed JSX is the canonical authoring
representation, fields are referenced through typed handles rather than strings, and external
state integrates through synchronous whole-record adapters so every write shares one atomic,
validated path. Provider-owned state remains separate and owns cross-Panel visibility, placement,
activation, z-order, and layout persistence.

A Dashboard remains an application composition rather than a Picodash component.
`@picodash/panel/dashlet` owns the semantic, theme-aware anatomy for custom Dashlets, while
`@picodash/panel/ui` remains the lower-level accessible foundation. These boundaries let agents
compose intent-revealing interfaces without coupling the state engine to React or turning the UI
foundation into an application component library.

## Rejected alternatives

- Keeping the per-Panel engine inside `@picodash/panel` would couple reusable state and validation
  to the rendering package.
- String field identifiers and component-owned defaults would weaken type-guided authoring and
  permit contracts to drift between Dashlets.
- Per-field external adapters would make compound writes, reset, repair, and import non-atomic.
- A first-class Dashboard component would impose application structure that belongs to the host.
- Keeping semantic Dashlet anatomy in `/ui` would blur intent-level composition with low-level
  primitives.
