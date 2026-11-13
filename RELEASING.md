# Release verification

The workspace currently uses pre-release version `0.0.0` for its product packages. Historical alpha/milestone prose is archived.
A passing `bun run ready` checks audit, package release contracts, agent artifacts, evaluation seeds, workspace checks, tests, builds and browser suites.
Record the source revision and actual result. A local bundle or a passing gate does not publish a registry release.
Use [local packages](docs/development/local-packages.md) or [portable bundles](docs/development/dogfooding.md) for consumer verification.
