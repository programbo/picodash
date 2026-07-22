# Releasing Picodash

The published package is `packages/panel`; the private workspace package at
the repository root is not released.

## Version policy

Picodash uses Semantic Versioning with a deliberate pre-1.0 policy:

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
2. Update `packages/panel/package.json` and the `Unreleased` section of
   `CHANGELOG.md`.
3. Run the full gate:

   ```bash
   bun run ready
   bun audit --audit-level=high
   bun run --cwd packages/panel release:check
   ```

4. Move the entries from `Unreleased` into a versioned heading such as
   `## [0.1.0] - 2026-07-22`, then recreate an empty `Unreleased` section.
5. Commit the package version and finalized changelog on the release branch,
   run `git diff --check`, and confirm the worktree is clean before tagging.
6. Confirm that the package version, changelog heading, and annotated tag will
   all use the same version, such as `0.1.0` and `v0.1.0`.
7. Create the annotated tag in the form `v<package-version>`.
8. Create a GitHub Release from that tag with the changelog entries.
9. For the first npm release, publish manually from the clean checkout using
   an interactive npm login with account-level two-factor authentication. Do
   not store an npm token in the repository or workflow configuration.
10. For later releases, configure npm trusted publishing for the repository's
    release workflow and publish through that workflow instead of a long-lived
    token.
11. Install the published package in a clean example project and verify the
    documented entrypoints and stylesheet import.

The first release is deliberately manual so the package name, metadata,
account ownership, and clean-install path can be verified. Automation can be
added for subsequent releases after trusted publishing has been configured.
