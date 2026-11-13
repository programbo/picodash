# Add an application monitor with Picodash

You are working in an existing Vite React application that demonstrates deterministic service
samples. Add Picodash as an application-monitoring surface.

Requirements:

- Create a native typed Picodash Nexus as the authoritative state for one monitoring Panel.
- Model fields for request rate, p95 latency, error rate, deployment progress, service status, and
  a bounded history of samples. Put defaults and durable validation in field definitions.
- Replace the seed's local sample record with Nexus-backed values; do not mirror two mutable
  records with effects.
- Add an initially visible Panel snapped to the top-right corner. It must be collapsible, dismissible,
  and reopenable from a labelled launcher.
- Compose a **Service health** compound Dashlet containing metrics, semantic status, progress, and
  a streaming visualization. Use the public `Dashlet` shell, accepted Dashlet anatomy, accessible
  UI primitives, semantic HTML, and an accessible SVG or equivalent visualization.
- The **Advance sample** action must append exactly one deterministic sample and update the host
  summary and Panel from the same Nexus transaction.
- The history must remain bounded to the most recent 12 samples.
- Expose the monitor to authenticated operators and developers, but not ordinary end users. Keep
  the seed's role chooser as the deterministic policy boundary and gate both Panel and launcher.
- Import the complete Picodash stylesheet and support light, dark, and system themes.
- Preserve labels, live-status semantics, keyboard operation, focus restoration, contrast, and
  reduced motion. The streaming visualization needs an accessible name and textual fallback.
- Keep existing test IDs and add those named by acceptance where semantic roles are insufficient.
- Update the local README with install, run, Nexus, exposure, and verification notes.

Do not edit `acceptance/`. Run the build and `bun run acceptance` before finishing.
