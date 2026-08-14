'use client'

import { createContext, useContext, useLayoutEffect, useRef, type RefObject } from 'react'

export type DashletPrimaryFocusRef = RefObject<HTMLElement | null>

type RegisteredTarget = {
  readonly ref: DashletPrimaryFocusRef
  node: HTMLElement | null
}

export type DashletPrimaryFocusCoordinator = {
  readonly register: (ref: DashletPrimaryFocusRef) => () => void
  readonly focusPrimary: () => void
  readonly repair: () => void
}

type CoordinatorOptions = {
  readonly shellRef: RefObject<HTMLElement | null>
  readonly primaryFocusRef: DashletPrimaryFocusRef | undefined
}

export const DashletPrimaryFocusContext = createContext<DashletPrimaryFocusCoordinator | null>(null)

function isElement(node: unknown): node is HTMLElement {
  return (
    typeof node === 'object' &&
    node !== null &&
    'nodeType' in node &&
    node.nodeType === 1 &&
    'ownerDocument' in node
  )
}

function activeElementFor(element: HTMLElement): Element | null {
  const root = element.getRootNode()
  if ('activeElement' in root) {
    const activeElement = root.activeElement
    return isElement(activeElement) ? activeElement : null
  }
  return element.ownerDocument.activeElement
}

function isUnavailable(element: HTMLElement, ownerDocument: Document): boolean {
  if (!element.isConnected || element.ownerDocument !== ownerDocument) return true
  if (element.hidden || element.inert || element.hasAttribute('inert')) return true
  if ('disabled' in element && Boolean(element.disabled)) return true
  if (element.matches(':disabled')) return true
  if (element.getAttribute('aria-disabled') === 'true') return true

  let current: HTMLElement | null = element
  while (current) {
    if (
      current.hidden ||
      current.inert ||
      current.hasAttribute('inert') ||
      current.matches(':disabled') ||
      current.getAttribute('aria-hidden') === 'true' ||
      current.getAttribute('aria-disabled') === 'true'
    )
      return true
    current = current.parentElement
  }
  return false
}

function focusIfUsable(element: HTMLElement | null, ownerDocument: Document): boolean {
  if (!element || isUnavailable(element, ownerDocument)) return false
  element.focus()
  return activeElementFor(element) === element
}

function isFocused(element: HTMLElement): boolean {
  return activeElementFor(element) === element
}

function createCoordinator({ shellRef, primaryFocusRef }: CoordinatorOptions) {
  const registered: RegisteredTarget[] = []
  let currentPrimaryRef = primaryFocusRef
  let lastCustomNode: HTMLElement | null = null
  let lastFocusedTarget: HTMLElement | null = null
  let repairPending = false

  const ownerDocument = (): Document | null => shellRef.current?.ownerDocument ?? null
  const focusTarget = (): boolean => {
    const document = ownerDocument()
    if (!document) return false
    if (currentPrimaryRef !== undefined) {
      const custom = currentPrimaryRef.current
      if (custom) lastCustomNode = custom
      return focusIfUsable(custom, document)
    }

    for (const target of registered) {
      const node = target.ref.current ?? target.node
      target.node = node
      if (focusIfUsable(node, document)) return true
    }
    return false
  }

  const focusPrimary = (): void => {
    const document = ownerDocument()
    const shell = shellRef.current
    if (!document || !shell) return
    if (!focusTarget()) shell.focus()
  }

  const repair = (): void => {
    const document = ownerDocument()
    if (
      !repairPending &&
      document &&
      lastFocusedTarget &&
      isUnavailable(lastFocusedTarget, document)
    )
      repairPending = true
    if (!repairPending) return
    repairPending = false
    focusPrimary()
  }

  const register = (ref: DashletPrimaryFocusRef): (() => void) => {
    const target: RegisteredTarget = { ref, node: ref.current }
    registered.push(target)
    if (repairPending) repair()
    return () => {
      const index = registered.indexOf(target)
      if (index < 0) return
      const node = target.node ?? target.ref.current
      if (node && isFocused(node)) repairPending = true
      registered.splice(index, 1)
    }
  }

  return {
    register,
    focusPrimary,
    repair,
    setPrimaryRef: (ref: DashletPrimaryFocusRef | undefined): void => {
      const previousRef = currentPrimaryRef
      const previous = currentPrimaryRef?.current ?? lastCustomNode
      const next = ref?.current ?? null
      if (previousRef === ref && previous && previous !== next && isFocused(previous))
        repairPending = true
      currentPrimaryRef = ref
      if (next) lastCustomNode = next
    },
    observeFocus: (event: FocusEvent): void => {
      if (!isElement(event.target)) return
      const target = event.target
      const isRegistered = registered.some(
        (entry) => entry.ref.current === target || entry.node === target,
      )
      if (isRegistered || currentPrimaryRef?.current === target) {
        lastFocusedTarget = target
        if (currentPrimaryRef?.current === target) lastCustomNode = target
      } else lastFocusedTarget = null
    },
    observeBlur: (event: FocusEvent): void => {
      void event
    },
  }
}

export function useDashletPrimaryFocusCoordinator(
  options: CoordinatorOptions,
): DashletPrimaryFocusCoordinator {
  const coordinatorRef = useRef<ReturnType<typeof createCoordinator> | null>(null)
  if (coordinatorRef.current === null) coordinatorRef.current = createCoordinator(options)
  const coordinator = coordinatorRef.current
  coordinator.setPrimaryRef(options.primaryFocusRef)

  useLayoutEffect(() => {
    const document = options.shellRef.current?.ownerDocument
    if (!document) return
    const focus = (event: FocusEvent) => coordinator.observeFocus(event)
    const blur = (event: FocusEvent) => coordinator.observeBlur(event)
    document.addEventListener('focusin', focus, true)
    document.addEventListener('focusout', blur, true)
    coordinator.repair()
    return () => {
      document.removeEventListener('focusin', focus, true)
      document.removeEventListener('focusout', blur, true)
    }
  }, [coordinator, options.shellRef])
  useLayoutEffect(() => coordinator.repair())

  return coordinator
}

export function useDashletPrimaryFocusTarget(ref: DashletPrimaryFocusRef): void {
  const coordinator = useContext(DashletPrimaryFocusContext)
  useLayoutEffect(() => coordinator?.register(ref), [coordinator, ref])
}

function composedPath(event: MouseEvent, ownerDocument: Document): readonly EventTarget[] {
  if (typeof event.composedPath === 'function') return event.composedPath()
  const path: EventTarget[] = []
  const NodeConstructor = ownerDocument.defaultView?.Node
  let current: Node | null =
    NodeConstructor && event.target instanceof NodeConstructor ? event.target : null
  while (current) {
    path.push(current)
    current = current.parentNode
  }
  return path
}

const interactiveAriaRoles = new Set([
  'button',
  'checkbox',
  'combobox',
  'grid',
  'gridcell',
  'link',
  'listbox',
  'menu',
  'menubar',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'radio',
  'radiogroup',
  'scrollbar',
  'searchbox',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'tablist',
  'textbox',
  'tree',
  'treegrid',
  'treeitem',
])

function isInteractive(element: HTMLElement): boolean {
  const tag = element.localName
  if (
    (tag === 'a' && element.hasAttribute('href')) ||
    (tag === 'area' && element.hasAttribute('href')) ||
    tag === 'button' ||
    tag === 'input' ||
    tag === 'select' ||
    tag === 'textarea' ||
    tag === 'option' ||
    tag === 'summary' ||
    (tag === 'audio' && element.hasAttribute('controls')) ||
    (tag === 'video' && element.hasAttribute('controls')) ||
    tag === 'iframe' ||
    tag === 'embed' ||
    tag === 'object' ||
    (element.hasAttribute('contenteditable') &&
      element.getAttribute('contenteditable') !== 'false') ||
    element.hasAttribute('tabindex')
  )
    return true
  const role = element.getAttribute('role')?.trim().split(/\s+/u)[0]?.toLowerCase()
  return role !== undefined && interactiveAriaRoles.has(role)
}

export function shouldRedirectDashletRowClick(event: MouseEvent, row: HTMLElement): boolean {
  if (event.defaultPrevented) return false
  const document = row.ownerDocument
  const view = document.defaultView
  const selection = view?.getSelection() ?? document.getSelection()
  if (selection && !selection.isCollapsed) return false

  let reachedRow = false
  for (const member of composedPath(event, document)) {
    if (!isElement(member)) continue
    if (member === row) {
      reachedRow = true
      break
    }
    if (member.parentElement === row && member.hasAttribute('data-picodash-dashlet-shell')) continue
    if (
      isInteractive(member) ||
      member.hasAttribute('data-picodash-dashlet-help') ||
      member.hasAttribute('data-picodash-reorder-handle') ||
      member.hasAttribute('data-picodash-dashlet-actions')
    )
      return false
  }
  return reachedRow
}
