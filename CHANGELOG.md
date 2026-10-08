# Changelog

All notable changes to the published `@picodash/picodash` package will be documented in
this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and releases follow the versioning policy in [RELEASING.md](RELEASING.md).

## [Unreleased]

No published package release exists yet.

### Breaking preview changes

- Rename DashList to **DashStack** (`@picodash/dashstack`) across components, types, actions,
  catalog identities, styles, and Nexus integration. `useDashStackActions` exposes `resetStack`;
  the reset item is `DashStackResetStackItem`.
- Durable scope metadata now uses `dashStack`. Preview documents and persistence containing
  `dashList` require replacement; no legacy aliases or automatic migration are provided.
  See [ADR 0007](docs/adr/0007-dashstack-name-and-public-identity.md).
