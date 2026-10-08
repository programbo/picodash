# Planetary Lab

Open `/lab/planetary`, or follow **Planetary Lab** from the Dashlet gallery. This is an
application example of Nexus values, grouped Dashlets, inferred results, and order-owned policy.
There are no visualisations or CAD outputs.

The two root targets are reduction and transverse module (tooth size). Their committed DashStack
order sets lexicographic preference: minimise the higher target's error first, then the lower
one's. Physical limits always remain hard constraints. Reordering previews do not recompute the
policy. The initial 5:1 and 1.5 mm targets deliberately compete inside a 90 mm envelope.

The `design` Nexus field stores only requested values. Results are computed from that value and
`useDashStackOrder('root')`. No derived solution or duplicate priority flag is stored. Input
validation rejects infeasible proposals; the accepted design remains intact while the initiating
Dashlet displays its draft error. **Discard changes** discards the failed draft. **Reset** replaces
the ephemeral example instance and clears both input and ordering state.

## Solver provenance

`solver.ts`, `tooth-profile.ts`, and `mesh-contact.ts` are a bounded source adaptation of
`/Volumes/Jove/3D Print/planetary/src/lib/{planetary,tooth-profile,mesh-contact}.ts`, inspected on
2026-10-08 at source repository HEAD `378b09ea8db67bfd14384312f1e7216d1273c82c`.
John's existing calculator remains unchanged and is the source of the geometry policy. The Lab
copies its pure calculation code to remain independently buildable without cross-repository
runtime imports. It does not import the calculator UI, animations, meshes, or deployment setup.

The adaptation adds optional ratio/module priority to the comparator and omits the original
application reducer. With no preference, the source ranking remains intact. With preference,
ratio/module errors lead, followed by the original pressure-angle, module, planet-count and
actual-diameter tie-breakers. `model.test.ts` checks source-default parity, order effects, physical
invariants, rejection, and canonical write closure.

Retained checks include `R = S + 2P`, equal-spacing divisibility, planet clearance, bore material,
undercut tooth floors, tooth-tip land, root-blend fit, and transverse contact screening. The Lab
uses automatic pressure angle, 0.20 mm backlash, and 0.15 mm root fillet. It omits maximum-reduction
mode, fixed-module locks, profile editors, axial assembly, exports, and visualisations. These are
prototype geometry checks, not strength, manufacturing, or CAD compatibility certification.
