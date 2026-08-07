# Add debug and feature controls with Picodash

You are working in an existing Next.js App Router application backed by a small framework-neutral
external domain store. Add Picodash debug and feature controls without moving that state into
Picodash or duplicating it.

Requirements:

- Keep `featureStore` authoritative and connect it through one synchronous whole-record Picodash
  adapter implementing `getSnapshot`, `subscribe`, and atomic `setValues`.
- Define typed Picodash fields and durable validation for the complete external value record.
- Add an initially visible Panel snapped to the bottom-left corner. It must be collapsible,
  dismissible, and reopenable from a persistent, clearly labelled launcher.
- Add controls for log level and API endpoint.
- Add a **Feature rollout** compound Dashlet that binds `newSearch` and `rolloutPercent` as one
  registered, reorderable, resettable unit.
- Add explicit actions for **Clear cache** and **Simulate failure**. Actions must call domain
  methods, expose pending/success/failure state accessibly, and must not be represented as writable
  value fields.
- Preserve the seed's exposure policy control. Only the developer role may see either the Panel or
  launcher; operators and end users must not receive debug controls in the DOM.
- Import the complete Picodash stylesheet and support light, dark, and system themes.
- Use the public `Dashlet` shell, accepted Dashlet anatomy, and accessible primitives for custom
  content.
- Preserve keyboard operation, visible labels, focus restoration, contrast, and reduced motion.
- Keep existing test IDs and add those named by acceptance where semantic roles are insufficient.
- Update the local README with install, run, adapter, exposure, action, and verification notes.

Do not edit `acceptance/`. Run the build and `bun run acceptance` before finishing.
