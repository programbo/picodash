// Adapted from John’s planetary calculator; see README.md for provenance and scope.
import { rootBlend, toothGeometry, type OutlineOptions, type ToothProfile } from './tooth-profile'

// Prototype margin above continuous single-pair transverse contact, not a
// material, load or printer rating. No credit is taken for helical overlap.
export const MIN_TRANSVERSE_CONTACT_RATIO = 1.2
export type MeshContact = {
  pathLength: number
  contactRatio: number
  involuteMargin: number
}
export type ContactScreen = { sunPlanet: MeshContact; planetRing: MeshContact }
type GearSet = { sun: number; planet: number; ring: number; module: number }

// Roll distance along a base-circle tangent. Below-base radial continuations
// and root blends are deliberately excluded from useful involute contact.
function flank(options: OutlineOptions) {
  const g = toothGeometry(options)
  const blend = rootBlend(options)
  if (!blend || g.tip < g.base) return null
  const roll = (radius: number) => Math.sqrt(Math.max(0, radius * radius - g.base * g.base))
  return { tip: roll(g.tip), join: roll(Math.max(g.base, blend.joinRadius)) }
}
export function meshContact(gears: GearSet, profile: ToothProfile): ContactScreen | null {
  const { module } = gears
  const sun = flank({ ...profile, teeth: gears.sun, module, kind: 'external' })
  const planet = flank({ ...profile, teeth: gears.planet, module, kind: 'external' })
  const ring = flank({ ...profile, teeth: gears.ring, module, kind: 'internal' })
  if (!sun || !planet || !ring) return null
  const alpha = (profile.pressureAngle * Math.PI) / 180
  const tangentSpan = ((gears.sun + gears.planet) * module * Math.sin(alpha)) / 2
  const basePitch = Math.PI * module * Math.cos(alpha)
  const externalPath = sun.tip + planet.tip - tangentSpan
  const internalPath = planet.tip - ring.tip + tangentSpan
  return {
    sunPlanet: {
      pathLength: externalPath,
      contactRatio: externalPath / basePitch,
      involuteMargin: Math.min(
        tangentSpan - planet.tip - sun.join,
        tangentSpan - sun.tip - planet.join,
      ),
    },
    planetRing: {
      pathLength: internalPath,
      contactRatio: internalPath / basePitch,
      involuteMargin: Math.min(
        ring.tip - tangentSpan - planet.join,
        ring.join - tangentSpan - planet.tip,
      ),
    },
  }
}
export function passesContactScreen(screen: ContactScreen | null): boolean {
  return (
    screen !== null &&
    [screen.sunPlanet, screen.planetRing].every(
      (mesh) => mesh.involuteMargin >= -1e-9 && mesh.contactRatio >= MIN_TRANSVERSE_CONTACT_RATIO,
    )
  )
}
