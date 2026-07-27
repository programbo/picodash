# Picodash Domain Glossary

- **Picodash** — the product and project name.
- **`@picodash`** — the npm organisation and package scope.
- **`@picodash/panel`** — the installable React package.
- **Dashlet** — a composable Picodash unit. The public component identifier for a dashlet is `PicodashPanel`.
- **Panel** — the technical/package term retained in package names, state, geometry, persistence, and API identifiers.
- **Placement mode** — a panel's stable movement policy: Floating, Fixed, or Hybrid.
- **Disposition** — a panel's current relationship to its boundary: Free, Snapped, or Docked.
- **Free** — positioned by preferred Cartesian coordinates and not attached to a boundary edge.
- **Snapped** — offset from a boundary edge or corner while retaining floating appearance and behavior.
- **Docked** — flush with a boundary edge or corner and using fixed appearance and behavior.
- **Preferred coordinates** — the boundary-relative point selected by the user before containment is applied.
