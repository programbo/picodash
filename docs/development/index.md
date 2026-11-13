# Development

Use Bun and the repository's installed Vite+ tools. `bun install --frozen-lockfile` installs the locked workspace.
The manifests currently require Bun >=1.4.2 and Node ^22.18, ^24.11, or >=26. Use `vp env doctor` if the toolchain is wrong.

Reserve a worktree web port with `bun run port:reserve`. `bun run lab` starts the Contract Lab; `bun run web` starts the evaluation site.
These share the worktree's allocated port and must run sequentially. Stop owned servers and run `bun run port:release` after merge.
The Bridge may allocate additional ephemeral loopback ports. Never print its bearer credentials.

`/lab` opens the Dashlet gallery. **Contract tools** opens six presets: placement, value binding, composition, overlays, documents and themes.
The resize scenario lives inside placement. `/lab/planetary` is an application-owned controls example.
Checked-in audit reports are historical evidence, not current release status. `apps/web` exposes the public evaluation homepage.

| Task                            | Command                                             |
| ------------------------------- | --------------------------------------------------- |
| Check one package               | `bun run --cwd packages/nexus check`                |
| Test one package                | `bun run --cwd packages/nexus test`                 |
| Verify package artifacts        | `bun run release:check`                             |
| Browser tests                   | `bun run test:e2e:lab`, then `bun run test:e2e:web` |
| Full release gate               | `bun run ready`                                     |
| Rebuild source-derived API docs | `bun run docs:generate`, then `bun run docs:check`  |

See [testing](../../TESTING.md), [Dev Bridge](agent-dev-bridge.md), [portable dogfood bundles](dogfooding.md),
and [local package archives](local-packages.md). `evaluations/v1` contains frozen host scenarios and their own acceptance fixtures.
Their README files are fixture inputs and retain their original wording.
