# Add creative controls with Picodash

You are working in an existing Next.js App Router application. Add Picodash as an unobtrusive
creative-control surface without replacing the application's existing React-owned scene state.

Requirements:

- Keep the scene's `useState` record authoritative and connect Picodash through one synchronous
  manual whole-record adapter. Do not mirror values through an effect.
- Add an initially visible Panel snapped to the bottom-right corner. It must be collapsible,
  dismissible, and reopenable with a clearly labelled launcher.
- Add built-in controls for bloom and render quality.
- Add one custom compound Dashlet named **Atmosphere**. It is one registered, reorderable,
  resettable Dashlet that binds the `exposure`, `temperature`, and `vignette` fields together.
- Compose the compound Dashlet with the public `Dashlet` shell, accepted Dashlet anatomy, and
  accessible UI primitives. Do not copy Picodash internal styles or components.
- Keep host controls and Panel controls synchronized in both directions.
- Use an explicit development-tool exposure decision: the Panel and its launcher are available in
  development, and unavailable in production builds.
- Preserve the application canvas and avoid shifting its layout.
- Import the complete Picodash stylesheet and support light, dark, and system themes.
- Preserve keyboard operation, visible labels, focus restoration after dismissal, and reduced
  motion.
- Keep the existing test IDs. Add the test IDs named by the acceptance tests where the semantic
  role and accessible name alone are insufficient.
- Update the local README with install, run, state-ownership, exposure, and verification notes.

Do not edit `acceptance/`. Run the build and `bun run acceptance` before finishing.
