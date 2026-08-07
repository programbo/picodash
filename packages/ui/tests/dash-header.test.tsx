import { createElement, createRef, type ReactElement } from 'react'
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vite-plus/test'
import { DashHeader } from '../src/index.tsx'

function render(element: ReactElement, rootNode: HTMLDivElement = {} as HTMLDivElement) {
  let renderer!: ReactTestRenderer
  act(() => {
    renderer = create(element, {
      createNodeMock: (node) =>
        node.type === 'div' &&
        (node.props as { 'data-slot'?: string })['data-slot'] === 'dash-header'
          ? rootNode
          : null,
    })
  })
  return { renderer, rootNode }
}

function root(renderer: ReactTestRenderer): ReactTestInstance {
  return renderer.root.findByProps({ 'data-slot': 'dash-header' })
}

describe('@picodash/ui DashHeader', () => {
  it('renders a neutral div, forwards its ref, and preserves native props', () => {
    const ref = createRef<HTMLDivElement>()
    const onClick = vi.fn()
    const style = { color: 'red' }
    const dataProps = { 'data-testid': 'header', 'data-slot': 'caller-value' }
    const { renderer, rootNode } = render(
      createElement(DashHeader, {
        ref,
        id: 'inspector-header',
        className: 'caller-class',
        style,
        'aria-label': 'Inspector',
        onClick,
        slots: { title: 'Inspector' },
        ...dataProps,
      }),
    )
    const output = root(renderer)

    expect(output.type).toBe('div')
    expect(ref.current).toBe(rootNode)
    expect(output.props).toMatchObject({
      id: 'inspector-header',
      className: 'caller-class',
      style,
      'aria-label': 'Inspector',
      'data-testid': 'header',
      onClick,
      'data-slot': 'dash-header',
    })
    act(() => renderer.unmount())
  })

  it('renders wrappers in fixed order and uses fixed hooks', () => {
    const { renderer } = render(
      createElement(DashHeader, {
        slots: {
          leading: 'Leading',
          title: 'Title',
          actions: 'Actions',
          trailing: 'Trailing',
        },
      }),
    )
    const output = root(renderer)

    expect(output.children.map((child) => (child as ReactTestInstance).props['data-slot'])).toEqual(
      ['dash-header-leading', 'dash-header-title', 'dash-header-actions', 'dash-header-trailing'],
    )
    expect(output.props['data-slot']).toBe('dash-header')
    act(() => renderer.unmount())
  })

  it('always renders title and applies non-nullish presence to optional slots', () => {
    const { renderer } = render(
      createElement(DashHeader, {
        slots: {
          leading: 0,
          title: null,
          actions: false,
          trailing: '',
        },
      }),
    )
    const output = root(renderer)
    expect(output.children.map((child) => (child as ReactTestInstance).props['data-slot'])).toEqual(
      ['dash-header-leading', 'dash-header-title', 'dash-header-actions', 'dash-header-trailing'],
    )
    act(() => renderer.unmount())

    const { renderer: emptyRenderer } = render(
      createElement(DashHeader, {
        slots: { leading: undefined, title: undefined, actions: null, trailing: null },
      }),
    )
    const emptyOutput = root(emptyRenderer)
    expect(
      emptyOutput.children.map((child) => (child as ReactTestInstance).props['data-slot']),
    ).toEqual(['dash-header-title'])
    act(() => emptyRenderer.unmount())
  })

  it('renders slot nodes without adding semantics, props, or handlers', () => {
    const onClick = vi.fn()
    const slots = {
      leading: createElement('button', { type: 'button', onClick, 'aria-label': 'Move' }, 'Move'),
      title: createElement('h2', { id: 'title' }, 'Inspector'),
      actions: createElement('span', { role: 'img', 'aria-label': 'Status' }, '●'),
      trailing: createElement('strong', { title: 'Close' }, 'X'),
    }
    const { renderer } = render(createElement(DashHeader, { slots }))
    const output = root(renderer)

    expect(output.findByType('button').props).toEqual(slots.leading.props)
    expect(output.findByType('h2').props).toEqual(slots.title.props)
    expect(output.findByType('span').props).toEqual(slots.actions.props)
    expect(output.findByType('strong').props).toEqual(slots.trailing.props)
    expect(output.findByType('button').props.onClick).toBe(onClick)
    expect(output.findByType('button').props['data-slot']).toBeUndefined()
    act(() => renderer.unmount())
  })
})
