# Releasing Tweaker

The published package is `packages/tweaker`; the private workspace package at
the repository root is not released.

## Version policy

Tweaker uses Semantic Versioning with a deliberate pre-1.0 policy:

- Start the first public npm release at `0.1.0`.
- Use patch releases for backwards-compatible fixes and security fixes.
- Use minor releases for features and any breaking changes while the major
  version is zero. Breaking changes must be called out prominently.
- After `1.0.0`, use major releases for breaking API changes, minor releases
  for backwards-compatible features, and patch releases for fixes.
- Published versions and Git tags are immutable. Never reuse a version number
  or move an existing release tag.

## Release checklist

1. Work from an up-to-date `main` checkout.
2. Update `packages/tweaker/package.json` and the `Unreleased` section of
   `CHANGELOG.md`.
3. Run the full gate:

   ```bash
   bun run ready
   bun run --cwd packages/tweaker release:check
   ```

4. Create an annotated tag in the form `v<package-version>`, for example
   `v0.1.0`.
5. Create a GitHub Release from that tag with the changelog entries.
6. Publish to npm only after configuring npm trusted publishing for the
   repository's release workflow.
7. Install the published package in a clean example project and verify the
   documented entrypoints and stylesheet import.

The first npm release should be a deliberate manual release. Automation can be
added after the package metadata, trusted publisher, and clean-install checks
have been confirmed.
