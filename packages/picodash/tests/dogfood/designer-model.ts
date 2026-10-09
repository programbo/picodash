import {
  createPicodashNexus,
  type PicodashIssueInput,
  type PicodashParseResult,
  type PicodashPersistenceDriver,
} from '@picodash/nexus'

// Consumer-owned example policy, not a planetary solver or a Picodash API.
export type Design = { ratio: number; module: number; diameter: number }
export type Priority = 'ratio' | 'module'
export type Solution = { profilePath: string; halfExtent: number; summary: string }
export type Solver = (design: Readonly<Design>, priority: Priority) => Solution | null
export const scopeId = 'designer'
export const targetsId = 'targets'
export const targetIds: readonly string[] = ['reduction', 'tooth-size']
export const defaultDesign: Design = { ratio: 5, module: 1.5, diameter: 90 }
export const designKeys: readonly (keyof Design)[] = ['ratio', 'module', 'diameter']

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
export function isDesign(value: unknown): value is Design {
  return (
    record(value) &&
    Object.keys(value).length === 3 &&
    typeof value.ratio === 'number' &&
    Number.isFinite(value.ratio) &&
    typeof value.module === 'number' &&
    Number.isFinite(value.module) &&
    typeof value.diameter === 'number' &&
    Number.isFinite(value.diameter)
  )
}

function parseDraft(raw: unknown): PicodashParseResult<Design> {
  if (!record(raw)) return { ok: false, issues: [{ message: 'Enter a design record.' }] }
  const numeric = (value: unknown) =>
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN
  const candidate = {
    ratio: numeric(raw.ratio),
    module: numeric(raw.module),
    diameter: numeric(raw.diameter),
  }
  const issues: PicodashIssueInput[] = designKeys.flatMap((key) =>
    Number.isFinite(candidate[key]) ? [] : [{ path: [key], message: `Enter a number for ${key}.` }],
  )
  const [first, ...rest] = issues
  return first ? { ok: false, issues: [first, ...rest] } : { ok: true, candidate }
}

function fields(solve: Solver) {
  return {
    design: {
      defaultValue: defaultDesign,
      parse: parseDraft,
      validate(candidate: unknown): readonly PicodashIssueInput[] {
        if (!isDesign(candidate))
          return [{ message: 'Expected finite ratio, module, and diameter numbers.' }]
        const issues: PicodashIssueInput[] = []
        if (candidate.ratio < 2.5 || candidate.ratio > 8)
          issues.push({ path: ['ratio'], message: 'Ratio must be between 2.5 and 8.' })
        if (candidate.module < 0.6 || candidate.module > 3)
          issues.push({ path: ['module'], message: 'Module must be between 0.6 and 3.' })
        if (candidate.diameter < 30 || candidate.diameter > 250)
          issues.push({ path: ['diameter'], message: 'Diameter must be between 30 and 250.' })
        if (issues.length) return issues
        // Both rankings must leave at least one feasible solution. Priority only ranks candidates.
        return solve(candidate, 'ratio') && solve(candidate, 'module')
          ? []
          : [{ message: 'No feasible solution. The accepted design is unchanged.' }]
      },
    },
  }
}
export function createDesigner(solve: Solver) {
  const nexus = createPicodashNexus({
    valueOwner: 'nexus',
    nexusId: 'designer-recipe',
    schemaVersion: 1,
    fields: fields(solve),
    export: { documents: { defaultFieldPolicy: 'include' } },
  })
  // Priority is required application data, including the default in a headless export.
  nexus.setDashStackGroupOrder(scopeId, targetsId, targetIds)
  return nexus
}
export function createPersistentDesigner(solve: Solver, driver: PicodashPersistenceDriver) {
  const nexus = createPicodashNexus({
    valueOwner: 'nexus',
    nexusId: 'designer-recipe',
    schemaVersion: 1,
    fields: fields(solve),
    export: { documents: { defaultFieldPolicy: 'include' } },
    persistence: {
      driver,
      storageKey: 'designer-recipe-v1',
      values: { defaultFieldPolicy: 'include' },
    },
  })
  // Hydration runs during creation. Preserve an existing saved priority.
  if (!nexus.getState().scopes.get(scopeId)?.dashStack?.groupOrders.has(targetsId))
    nexus.setDashStackGroupOrder(scopeId, targetsId, targetIds)
  return nexus
}
export type Designer = ReturnType<typeof createDesigner>
export type DesignerSnapshot = ReturnType<Designer['getState']>

// Valid only for this fixed, always-declared, unpinned two-item group.
export function priorityFromOrder(order: readonly string[]): Priority {
  const first = order.find((id) => targetIds.includes(id)) ?? targetIds[0]
  return first === 'tooth-size' ? 'module' : 'ratio'
}
export function selectDesign(snapshot: DesignerSnapshot, solve: Solver) {
  const order = snapshot.scopes.get(scopeId)?.dashStack?.groupOrders.get(targetsId) ?? targetIds
  const priority = priorityFromOrder(order)
  const solution = solve(snapshot.values.design, priority)
  return { requested: snapshot.values.design, priority, solution }
}
export function setPriority(nexus: Designer, priority: Priority) {
  const saved =
    nexus.getState().scopes.get(scopeId)?.dashStack?.groupOrders.get(targetsId) ?? targetIds
  if (priorityFromOrder(saved) === priority) return null // No write or notification.
  return nexus.setDashStackGroupOrder(
    scopeId,
    targetsId,
    priority === 'ratio' ? ['reduction', 'tooth-size'] : ['tooth-size', 'reduction'],
  )
}

// The accepted state stays separate from raw binding-local input.
export function draftMember(raw: unknown, canonical: Design, key: keyof Design): string {
  if (record(raw) && (typeof raw[key] === 'string' || typeof raw[key] === 'number'))
    return String(raw[key])
  return String(canonical[key])
}
