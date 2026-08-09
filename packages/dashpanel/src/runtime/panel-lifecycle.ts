import type { PanelRuntime } from './panel-runtime.ts'

interface FocusRecord {
  trigger?: WeakRef<HTMLElement>
  beforeEntry?: WeakRef<HTMLElement>
}

const records = new WeakMap<PanelRuntime, Map<string, FocusRecord>>()

function recordFor(runtime: PanelRuntime, scopeId: string): FocusRecord {
  let map = records.get(runtime)
  if (!map) {
    map = new Map()
    records.set(runtime, map)
  }
  let record = map.get(scopeId)
  if (!record) {
    record = {}
    map.set(scopeId, record)
  }
  return record
}

export function recordPanelEntry(
  runtime: PanelRuntime,
  scopeId: string,
  trigger: HTMLElement | null,
  beforeEntry: Element | null,
): void {
  const record = recordFor(runtime, scopeId)
  record.trigger = trigger ? new WeakRef(trigger) : undefined
  record.beforeEntry = beforeEntry instanceof HTMLElement ? new WeakRef(beforeEntry) : undefined
}

export function recordPanelInteraction(
  runtime: PanelRuntime,
  scopeId: string,
  beforeEntry: EventTarget | null,
): void {
  if (!(beforeEntry instanceof HTMLElement)) return
  const record = recordFor(runtime, scopeId)
  record.beforeEntry = new WeakRef(beforeEntry)
}

export function clearPanelFocusRecord(runtime: PanelRuntime, scopeId: string): void {
  records.get(runtime)?.delete(scopeId)
}

function connected(value: Element | null): value is HTMLElement {
  return (
    typeof HTMLElement !== 'undefined' &&
    value instanceof HTMLElement &&
    value.isConnected !== false
  )
}

function connectedReference(reference: WeakRef<HTMLElement> | undefined): HTMLElement | null {
  const value = reference?.deref() ?? null
  return connected(value) ? value : null
}

function focusable(element: HTMLElement): boolean {
  const hiddenAncestor = element.closest('[hidden], [inert], [aria-hidden="true"]')
  if (
    hiddenAncestor ||
    element.hidden ||
    element.getAttribute('aria-hidden') === 'true' ||
    element.hasAttribute('inert')
  )
    return false
  if (element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true')
    return false
  const tabindex = element.getAttribute('tabindex')
  if (tabindex !== null && Number(tabindex) < 0) return false
  if (tabindex !== null) return true
  if ((element.tagName === 'A' || element.tagName === 'AREA') && !element.hasAttribute('href'))
    return false
  if (element.tagName === 'INPUT' && element.getAttribute('type')?.toLowerCase() === 'hidden')
    return false
  return /^(A|AREA|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(element.tagName)
}

function rendered(element: HTMLElement): boolean {
  let current: HTMLElement | null = element
  while (current) {
    const style = typeof getComputedStyle === 'function' ? getComputedStyle(current) : undefined
    if (
      style?.display === 'none' ||
      style?.visibility === 'hidden' ||
      style?.visibility === 'collapse'
    )
      return false
    current = current.parentElement
  }
  return true
}

function tryFocus(element: HTMLElement, requireSequentialFocus = true): boolean {
  if (!connected(element) || !rendered(element)) return false
  if (requireSequentialFocus && !focusable(element)) return false
  if (element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true')
    return false
  if (typeof element.focus !== 'function') return false
  element.focus()
  return typeof document === 'undefined' || document.activeElement === element
}

function firstFocusTarget(panel: HTMLElement): HTMLElement | null {
  const descendants = panel.querySelectorAll<HTMLElement>(
    'a[href], area[href], button, input, select, textarea, summary, [tabindex]',
  )
  for (const candidate of descendants)
    if (focusable(candidate) && rendered(candidate)) return candidate
  return null
}

export function focusPanel(runtime: PanelRuntime, scopeId: string): void {
  const panel = runtime.getElement(scopeId)
  if (!panel) return
  const target = firstFocusTarget(panel)
  if (target && tryFocus(target)) return
  panel.tabIndex = -1
  tryFocus(panel, false)
}

function providerFallbackCandidates(
  boundary: Element | { readonly current: Element | null } | null | undefined,
  portalContainer: HTMLElement | null | undefined,
): readonly HTMLElement[] {
  const resolved: Element | null =
    boundary && 'current' in boundary ? boundary.current : (boundary ?? null)
  const portal = portalContainer ?? null
  const candidates: HTMLElement[] = []
  if (connected(resolved)) candidates.push(resolved)
  if (connected(portal) && portal !== resolved) candidates.push(portal)
  const body = typeof document !== 'undefined' ? document.body : null
  if (connected(body) && !candidates.includes(body)) candidates.push(body)
  return candidates
}

export function restorePanelFocus(
  runtime: PanelRuntime,
  scopeId: string,
  boundary: Element | { readonly current: Element | null } | null | undefined,
  portalContainer: HTMLElement | null | undefined,
): void {
  const record = records.get(runtime)?.get(scopeId)
  const trigger = connectedReference(record?.trigger)
  if (trigger && tryFocus(trigger)) return
  const beforeEntry = connectedReference(record?.beforeEntry)
  if (beforeEntry && tryFocus(beforeEntry)) return
  for (const fallback of providerFallbackCandidates(boundary, portalContainer))
    if (tryFocus(fallback, false)) return
}
