# ADR 0005: Picodash Nexus name and public identity

## Status

Accepted.

## Context

`@picodash/store` described one implementation mechanism but not the package's broader role. The
runtime defines typed field meaning and valid changes while coordinating canonical values, scoped
interaction and durable preferences, persistence, documents, adapters, diagnostics, and several
independent consumers. In external-owned mode it does not own the application values, so calling
the complete product a Store is especially misleading.

## Decision

The product is **Picodash Nexus**, published as `@picodash/nexus` and described as the typed state
hub for configurable interfaces. Its root and scoped public runtime types are `RootNexus` and
`ScopedNexus`. Store-named package paths, APIs, props, identities, persistence envelopes, document
fields, diagnostics, and public prose are replaced with Nexus terminology in one clean pre-release
cutover.

Lowercase “store” remains valid only for an application's external Redux, Zustand, or equivalent
state store. The rename does not move behavior or ownership between Nexus, DashPanel, DashList,
Picodash, or Dev Bridge.

## Consequences

Preview-era Store imports, API names, persistence envelopes, and documents receive no aliases or
migrations. This keeps one public vocabulary and prevents a permanent split between the product
name and its runtime contract.
