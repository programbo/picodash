# Picodash Product Contract

Picodash is the fastest reliable way to add flexible, unobtrusive control and monitoring
interfaces to an existing React application without building bespoke state, interaction, and
presentation infrastructure.

## Audience and Beachhead

The primary implementer is an AI coding agent supervised by a human developer. The initial
beachhead is an existing React application that needs an overlay surface for controls, operational
readouts, visualizations, previews, or actions.

Picodash targets React 19. Next.js App Router and Vite are the verified host environments.

## Product Difference

Picodash combines reusable typed state, validation, persistence, diagnostics, accessible
interaction infrastructure, placement, theming, and semantic composition elements. A developer or
agent can assemble polished Panels and custom Dashlets without inventing those systems for each
application.

## Exposure Policy

Every host application explicitly chooses who can access its Panels: developers, authenticated
operators, or end users. Picodash does not infer an audience or make a Panel public merely because
it is installed.

## Canonical Experience

The canonical Panel is initially visible, snapped unobtrusively to a corner, collapsible,
dismissible, non-layout-shifting, and explicitly reopenable. Hosts may choose another experience,
but examples and guidance start from this safe baseline.

## Accessibility

Picodash targets WCAG 2.2 Level AA across its components, interaction patterns, guidance, and
examples. This is an engineering target, not a claim of third-party certification.
