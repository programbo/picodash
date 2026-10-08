// Adapted from John’s planetary calculator; see README.md for provenance and scope.
export const PROFILE_FIELDS = [
  {
    key: 'pressureAngle',
    label: 'Transverse pressure angle',
    unit: '°',
    min: 14.5,
    max: 30,
    step: 0.5,
  },
  { key: 'backlash', label: 'Transverse backlash', unit: 'mm', min: 0.05, max: 0.6, step: 0.05 },
  { key: 'rootFillet', label: 'Root fillet', unit: 'mm', min: 0, max: 0.75, step: 0.05 },
] as const
export type ProfileFeature = (typeof PROFILE_FIELDS)[number]['key'] | 'module'
export function isProfileFeature(value: unknown): value is ProfileFeature {
  return value === 'module' || PROFILE_FIELDS.some((field) => field.key === value)
}
export type ToothProfile = { pressureAngle: number; backlash: number; rootFillet: number }
export const DEFAULT_PROFILE: ToothProfile = { pressureAngle: 20, backlash: 0.2, rootFillet: 0.15 }
export type Point = [number, number]
export type OutlineOptions = ToothProfile & {
  teeth: number
  module: number
  kind: 'external' | 'internal'
}
export function polar(radius: number, angle: number): Point {
  return [radius * Math.cos(angle), radius * Math.sin(angle)]
}
function involute(radius: number, base: number): number {
  if (radius <= base) return 0
  const tangent = Math.sqrt((radius / base) ** 2 - 1)
  return tangent - Math.atan(tangent)
}
export function toothGeometry({ teeth, module, kind, pressureAngle, backlash }: OutlineOptions) {
  const internal = kind === 'internal'
  const pitch = (teeth * module) / 2
  const base = pitch * Math.cos((pressureAngle * Math.PI) / 180)
  const root = pitch + (internal ? 1.25 : -1.25) * module
  const tip = pitch + (internal ? -1 : 1) * module
  const pitchAngle = (Math.PI * 2) / teeth
  const pitchHalfWidth = Math.PI / (2 * teeth) - backlash / (4 * pitch)
  const pitchInvolute = involute(pitch, base)
  const halfWidth = (radius: number) =>
    pitchHalfWidth + (internal ? 1 : -1) * (involute(radius, base) - pitchInvolute)
  return { internal, pitch, base, root, tip, pitchAngle, halfWidth }
}

// A circular, G1 root blend, tangent to the root circle and involute (or its
// radial extension below the base circle). This is not a generated cutter root.
export function rootBlend(options: OutlineOptions) {
  const geometry = toothGeometry(options)
  const { root, base, internal, halfWidth, pitchAngle } = geometry
  const radius = options.rootFillet
  const sign = internal ? -1 : 1
  function tangentCircle(r: number) {
    const angle = halfWidth(r)
    const slope = (internal ? 1 : -1) * Math.sqrt(Math.max(0, (r / base) ** 2 - 1))
    const norm = Math.hypot(1, slope)
    const q = polar(r, angle)
    const radial = polar((-radius * slope) / norm, angle)
    const azimuthal = polar(radius / norm, angle + Math.PI / 2)
    const centre: Point = [q[0] + radial[0] + azimuthal[0], q[1] + radial[1] + azimuthal[1]]
    return { q, centre, distance: Math.hypot(...centre) }
  }
  if (radius === 0) {
    const q = polar(root, halfWidth(root))
    return { joinRadius: root, rootAngle: halfWidth(root), centre: q, points: [q], radius }
  }
  // Restrict the whole blend to the existing 0.25-module tip/root clearance
  // band. It cannot add material inside the mating gear's tip envelope.
  const band = 0.25 * options.module
  const target = root + sign * radius
  let low = 0
  let high = band
  if (sign * (tangentCircle(root + sign * high).distance - target) < 0) return null
  for (let iteration = 0; iteration < 32; iteration++) {
    const middle = (low + high) / 2
    if (sign * (tangentCircle(root + sign * middle).distance - target) < 0) low = middle
    else high = middle
  }
  const joinRadius = root + sign * ((low + high) / 2)
  const { q, centre } = tangentCircle(joinRadius)
  const rootAngle = Math.atan2(centre[1], centre[0])
  if (rootAngle >= pitchAngle / 2) return null
  const a = polar(root, rootAngle)
  const start = Math.atan2(a[1] - centre[1], a[0] - centre[0])
  const end = Math.atan2(q[1] - centre[1], q[0] - centre[0])
  const sweep = Math.atan2(Math.sin(end - start), Math.cos(end - start))
  const points: Point[] = Array.from({ length: 13 }, (_, i) => {
    const offset = polar(radius, start + (sweep * i) / 12)
    return [centre[0] + offset[0], centre[1] + offset[1]]
  })
  if (points.some((point) => sign * (Math.hypot(...point) - root) > band + 1e-8)) return null
  return { joinRadius, rootAngle, centre, points, radius }
}

// Geometric anti-peaking margin in the transverse plane, not nozzle calibration.
export const MIN_TIP_LAND_COEFFICIENT_T = 0.25
export function validToothProfile(options: OutlineOptions): boolean {
  const { halfWidth, tip, root, pitchAngle } = toothGeometry(options)
  // Preserve a small, finite land at the tooth tip and between neighbouring roots.
  return (
    halfWidth(tip) * 2 * tip >= MIN_TIP_LAND_COEFFICIENT_T * options.module &&
    (pitchAngle - 2 * halfWidth(root)) * root >= 0.1 * options.module &&
    rootBlend(options) !== null
  )
}

export function minimumExternalTeeth(pressureAngle: number): number {
  // Standard, unshifted, full-depth rack: z >= 2 / sin(alpha)^2.
  return Math.ceil(2 / Math.sin((pressureAngle * Math.PI) / 180) ** 2)
}
