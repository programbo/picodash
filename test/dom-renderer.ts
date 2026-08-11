import { type ReactElement, type ReactNode } from 'react'
import { fireEvent, render } from '@testing-library/react'

// The compatibility API mirrors react-test-renderer's intentionally loose host props.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TestProps = Readonly<Record<string, any>>
const rendererDocument = document

function reactPropsFor(node: HTMLElement): TestProps {
  const key = Object.keys(node).find((candidate) => candidate.startsWith('__reactProps$'))
  return key ? ((node as unknown as Record<string, unknown>)[key] as TestProps) : {}
}

function belongsToRenderer(node: HTMLElement, container: HTMLElement) {
  const key = Object.keys(node).find((candidate) => candidate.startsWith('__reactFiber$'))
  let fiber = key
    ? ((node as unknown as Record<string, unknown>)[key] as
        | { return?: unknown; stateNode?: { containerInfo?: unknown }; tag?: number }
        | undefined)
    : undefined
  while (fiber) {
    if (fiber.tag === 3) return fiber.stateNode?.containerInfo === container
    fiber = fiber.return as typeof fiber
  }
  return false
}

function eventNameForProp(prop: string) {
  const normalized = prop.endsWith('Capture') ? prop.slice(0, -7) : prop
  if (normalized === 'onPress') return 'click'
  if (normalized === 'onBlur') return 'focusout'
  if (normalized === 'onFocus') return 'focusin'
  return normalized.slice(2).toLowerCase()
}

function dispatch(node: HTMLElement, prop: string, init: Record<string, unknown> = {}) {
  const eventName = eventNameForProp(prop)
  const eventValues = Object.fromEntries(
    Object.entries(init).filter(
      ([key]) =>
        key !== 'currentTarget' &&
        key !== 'nativeEvent' &&
        key !== 'preventDefault' &&
        key !== 'stopPropagation' &&
        key !== 'target',
    ),
  )
  if (eventName === 'click') return fireEvent.click(node, eventValues)
  if (eventName === 'keydown') return fireEvent.keyDown(node, eventValues)
  if (eventName === 'blur') return fireEvent.blur(node, eventValues)
  if (eventName === 'focus') return fireEvent.focus(node, eventValues)
  const event = new Event(eventName, { bubbles: true, cancelable: true })
  for (const [key, value] of Object.entries(eventValues)) {
    Object.defineProperty(event, key, { configurable: true, value })
  }
  const dispatched = fireEvent(node, event)
  if (event.defaultPrevented && typeof init.preventDefault === 'function') init.preventDefault()
  return dispatched
}

function valueForProp(node: HTMLElement, prop: string): unknown {
  if (prop === 'children') return childrenPropFor(node)
  const reactProps = reactPropsFor(node)
  if (prop.startsWith('onPointer') && Object.hasOwn(reactProps, prop)) return reactProps[prop]
  if (prop.startsWith('on')) return (init?: Record<string, unknown>) => dispatch(node, prop, init)
  if (Object.hasOwn(reactProps, prop)) return reactProps[prop]
  if (prop === 'className') return node.className || undefined
  if (prop === 'style') return node.style
  if (prop === 'defaultValue' && node instanceof HTMLInputElement) return node.defaultValue
  if (prop === 'disabled' || prop === 'isDisabled') {
    return node.hasAttribute('disabled') ? true : undefined
  }
  if (prop === 'hidden' || prop === 'inert') return node.hasAttribute(prop) ? true : undefined
  const attribute = node.getAttribute(prop)
  return attribute === null ? undefined : attribute
}

function childrenFor(node: HTMLElement): readonly (string | DomTestInstance)[] {
  return [...node.childNodes].map((child) =>
    child instanceof HTMLElement ? new DomTestInstance(child) : (child.textContent ?? ''),
  )
}

function childrenPropFor(node: HTMLElement) {
  const children = childrenFor(node)
  if (children.length === 0) return undefined
  return children.length === 1 ? children[0] : children
}

function matchesProps(node: HTMLElement, expected: TestProps) {
  return Object.entries(expected).every(([key, value]) => {
    const actual = valueForProp(node, key)
    if (value === true) return actual === true || actual === 'true'
    return actual === value
  })
}

function jsonFor(node: HTMLElement): unknown {
  return {
    type: node.tagName.toLowerCase(),
    props: Object.fromEntries([...node.attributes].map(({ name, value }) => [name, value])),
    children: [...node.childNodes].map((child) =>
      child instanceof HTMLElement ? jsonFor(child) : child.textContent,
    ),
  }
}

export class DomTestInstance {
  readonly #node: HTMLElement
  readonly #owner?: HTMLElement

  constructor(node: HTMLElement, owner?: HTMLElement) {
    this.#node = node
    this.#owner = owner
  }

  get children() {
    return childrenFor(this.#node)
  }

  get type() {
    return this.#node.tagName.toLowerCase()
  }

  get props(): TestProps {
    return new Proxy(
      { ...reactPropsFor(this.#node) },
      {
        get: (_target, prop) =>
          typeof prop === 'string' ? valueForProp(this.#node, prop) : undefined,
      },
    )
  }

  get rawProps(): TestProps {
    return reactPropsFor(this.#node)
  }

  get element() {
    return this.#node
  }

  findByType(type: string) {
    const match = this.findAll((node) => node.type === type)[0]
    if (!match) throw new Error(`No ${type} element was found.`)
    return match
  }

  findAllByType(type: string) {
    return this.findAll((node) => node.type === type)
  }

  findByProps(props: TestProps) {
    const match = this.findAll((node) => matchesProps(node.element, props))[0]
    if (!match) throw new Error(`No element matched ${JSON.stringify(props)}.`)
    return match
  }

  findAllByProps(props: TestProps) {
    return this.findAll((node) => matchesProps(node.element, props))
  }

  findAll(predicate: (node: DomTestInstance) => boolean) {
    return [...this.#node.querySelectorAll('*')]
      .filter((node): node is HTMLElement => node instanceof HTMLElement)
      .filter((node) => !this.#owner || belongsToRenderer(node, this.#owner))
      .map((node) => new DomTestInstance(node, this.#owner))
      .filter(predicate)
  }
}

export class DomTestRenderer {
  readonly #container: HTMLElement
  readonly #rerender: (element: ReactNode) => void
  readonly #unmount: () => void

  constructor(element: ReactElement) {
    const container = rendererDocument.createElement('div')
    rendererDocument.body.append(container)
    let result: ReturnType<typeof render>
    try {
      result = render(element, { container })
    } catch (error) {
      container.remove()
      throw error
    }
    this.#container = result.container
    this.#rerender = result.rerender
    this.#unmount = result.unmount
  }

  get root() {
    return new DomTestInstance(rendererDocument.body, this.#container)
  }

  update(element: ReactElement) {
    this.#rerender(element)
  }

  unmount() {
    this.#unmount()
    this.#container.remove()
  }

  toJSON() {
    const child = this.#container.firstElementChild
    return child instanceof HTMLElement ? jsonFor(child) : null
  }
}

export function createDomTestRenderer(element: ReactElement) {
  return new DomTestRenderer(element)
}
