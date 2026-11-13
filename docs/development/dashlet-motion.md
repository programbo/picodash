# Motion

Timed choreography imports Motion through its public entrypoint. CSS transitions use semantic duration tokens and reduced-motion handling. Shared UI scroll cues are a reviewed exception driven by scroll position rather than elapsed time.

Implementation: [source](../../scripts/check-motion-policy.mjs). Public names and signatures: [API inventory](../reference/api/index.md).
Examples and behavior checks: [consumer fixtures](../../packages/picodash/tests/dogfood).
