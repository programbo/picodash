# Picodash Product Contract

Picodash is the fastest reliable way to add flexible, unobtrusive control and monitoring
interfaces to an existing React application without building bespoke state, interaction, and
presentation infrastructure.

Picodash is productized around an agent-first workflow: a human developer supervises an AI coding
agent that composes or migrates Dashlets against explicit host contracts.

## Public product model

The package family is organized around three foundational products and one integrated product:

- `@picodash/store` provides typed values, scopes, metadata, persistence, and adapters.
- `@picodash/dashpanel` provides the standalone panel shell, placement, visibility, and lifecycle.
- `@picodash/dashlist` provides standalone lists, groups, and Dashlet composition.
- `@picodash/picodash` combines both products for an integrated control surface.

`@picodash/ui` is the supporting theme, density, token, and generic accessible UI foundation.
`@picodash/picodash` is the integrated public facade over the three foundational products.

The production website is intentionally a single route at `/`. Local debugging and contract checks
remain in `apps/lab` and are not part of the deployed website.

## Audience and Beachhead

The primary implementer is an AI coding agent supervised by a human developer.

The initial beachhead is an existing React application that needs an overlay surface for controls,
operational readouts, visualizations, previews, or actions.

## Supported Environments

Picodash targets React 19.

Verified host integrations are:

- Next.js App Router
- Vite apps/workflows

The product contract assumes host-owned routing and data transport. Picodash owns the control-plane UI,
state validation, interaction contracts, placement, persistence, and diagnostics.

## Product Difference

Picodash combines reusable typed state, validation, persistence, diagnostics, accessible
interaction infrastructure, placement, theming, and semantic composition elements. A developer or
agent can assemble polished Panels and custom Dashlets without inventing those systems for each
application.

## Exposure Policy

Every host explicitly chooses who can access each Panel:

- developers
- authenticated operators
- end users

Picodash does not infer an audience.

## Canonical Experience

The canonical Panel pattern is initially visible, snapped to a corner, collapsible, dismissible,
non-layout-shifting, and explicitly reopenable. Hosts may choose alternate placements and interaction
policies, but examples and default guidance begin with this stable baseline.

## Accessibility

Picodash targets WCAG 2.2 Level AA across components, interaction patterns, guidance, and examples.
This is an engineering target, not a claim of third-party certification.

## Domain Language

- `Panel`: the concrete place where controls and readouts render; exposed through `DashPanel` in
  both the standalone and integrated products.
- `Dashlet`: a unit of control, readout, visualization, preview, action, or compound composition.
- `Picodash Store`: the root typed state kernel for canonical values, field contracts, scopes,
  product metadata, interaction state, persistence, and repairs. Scoped Stores are immutable views
  of that root, not separate per-Panel stores.
- `Dashboard`: the application-level composition of one or more Panels and their Dashlets.
