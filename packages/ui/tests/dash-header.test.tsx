// @vitest-environment jsdom
import { act, createElement, createRef, type ReactElement } from 'react'
import { describe, expect, it, vi } from 'vite-plus/test'
import {
  createDomTestRenderer as create,
  type DomTestInstance,
  type DomTestRenderer,
} from '../../../test/dom-renderer.ts'
import { DashHeader } from '../src/index.tsx'

function render(element: ReactElement) {
  let renderer!: DomTestRenderer
  act(() => {
    renderer = create(element)
  })
  return { renderer, rootNode: renderer.root.findByProps({ 'data-slot': 'dash-header' }).element }
}

function root(renderer: DomTestRenderer): DomTestInstance {
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
      'data-slot': 'dash-header',
    })
    void act(() => output.props.onClick())
    expect(onClick).toHaveBeenCalledOnce()
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

    expect(output.children.map((child) => (child as DomTestInstance).props['data-slot'])).toEqual([
      'dash-header-leading',
      'dash-header-title',
      'dash-header-actions',
      'dash-header-trailing',
    ])
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
    expect(output.children.map((child) => (child as DomTestInstance).props['data-slot'])).toEqual([
      'dash-header-leading',
      'dash-header-title',
      'dash-header-actions',
      'dash-header-trailing',
    ])
    act(() => renderer.unmount())

    const { renderer: emptyRenderer } = render(
      createElement(DashHeader, {
        slots: { leading: undefined, title: undefined, actions: null, trailing: null },
      }),
    )
    const emptyOutput = root(emptyRenderer)
    expect(
      emptyOutput.children.map((child) => (child as DomTestInstance).props['data-slot']),
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

    expect(output.findByType('button').props).toMatchObject({
      type: 'button',
      'aria-label': 'Move',
      children: 'Move',
    })
    expect(output.findByType('h2').props).toMatchObject({ id: 'title', children: 'Inspector' })
    expect(output.findByType('span').props).toMatchObject({
      role: 'img',
      'aria-label': 'Status',
      children: '●',
    })
    expect(output.findByType('strong').props).toMatchObject({ title: 'Close', children: 'X' })
    void act(() => output.findByType('button').props.onClick())
    expect(onClick).toHaveBeenCalledOnce()
    expect(output.findByType('button').props['data-slot']).toBeUndefined()
    act(() => renderer.unmount())
  })
})
