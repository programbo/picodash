// @vitest-environment jsdom
import { act, createElement, createRef, type ReactElement } from 'react'
import { describe, expect, it, vi } from 'vite-plus/test'
import {
  createDomTestRenderer as create,
  type DomTestRenderer,
} from '../../../test/dom-renderer.ts'
import { Button } from '../src/index.tsx'

function render(element: ReactElement) {
  let renderer!: DomTestRenderer
  act(() => {
    renderer = create(element)
  })
  return { renderer, button: renderer.root.findByType('button').element as HTMLButtonElement }
}

function host(renderer: DomTestRenderer) {
  return renderer.root.findByType('button')
}

describe('@picodash/ui Button', () => {
  it('renders a semantic button, forwards its ref, and exposes defaults', () => {
    const ref = createRef<HTMLButtonElement>()
    const { renderer, button } = render(createElement(Button, { ref, children: 'Save' }))
    const output = host(renderer)

    expect(output.type).toBe('button')
    expect(ref.current).toBe(button)
    expect(output.props).toMatchObject({
      type: 'button',
      'data-slot': 'button',
      'data-variant': 'primary',
      'data-size': 'md',
      className: 'picodash-button',
    })
    expect(output.props['data-icon-only']).toBeUndefined()
    act(() => renderer.unmount())
  })

  it('preserves explicit variant, size, icon-only hook, and native type', () => {
    const { renderer } = render(
      createElement(Button, {
        variant: 'destructive',
        size: 'lg',
        iconOnly: true,
        type: 'submit',
        children: 'Delete',
      }),
    )
    expect(host(renderer).props).toMatchObject({
      type: 'submit',
      'data-variant': 'destructive',
      'data-size': 'lg',
      'data-icon-only': true,
    })
    act(() => renderer.unmount())
  })

  it('composes string and render-function class names with the private class', () => {
    const { renderer: stringRenderer } = render(
      createElement(Button, { className: 'caller-class', children: 'String' }),
    )
    expect(host(stringRenderer).props.className).toBe('picodash-button caller-class')
    act(() => stringRenderer.unmount())

    const className = vi.fn(({ isPending }: { isPending: boolean }) =>
      isPending ? 'pending-class' : 'function-class',
    )
    const { renderer: functionRenderer } = render(
      createElement(Button, { className, isPending: true, children: 'Function' }),
    )
    expect(host(functionRenderer).props.className).toBe('picodash-button pending-class')
    expect(className).toHaveBeenCalledWith(expect.objectContaining({ isPending: true }))
    act(() => functionRenderer.unmount())
  })

  it('keeps React Aria children and constrained render functions intact', () => {
    const child = ({ isPending }: { isPending: boolean }) => (isPending ? 'Waiting' : 'Ready')
    const { renderer } = render(
      createElement(Button, {
        isPending: true,
        children: child,
      }),
    )
    expect(host(renderer).children).toContain('Waiting')
    act(() => renderer.unmount())

    const { renderer: escapedRenderer } = render(
      createElement(Button, {
        render: (props, renderProps) =>
          createElement('button', {
            ...props,
            'data-escape-hatch': renderProps.isPending ? 'pending' : 'ready',
          }),
        children: 'Escaped',
      }),
    )
    const escaped = escapedRenderer.root.findByProps({ 'data-escape-hatch': 'ready' })
    expect(escaped.type).toBe('button')
    expect(escaped.props['data-slot']).toBe('button')
    act(() => escapedRenderer.unmount())
  })

  it('wires onPress and inherited onClick through React Aria click handling', () => {
    const onPress = vi.fn()
    const onClick = vi.fn()
    const { renderer, button } = render(
      createElement(Button, { onPress, onClick, children: 'Activate' }),
    )
    const output = host(renderer)
    const event = {
      button: 0,
      currentTarget: button,
      target: button,
      nativeEvent: { detail: 0, pointerType: '' },
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    }

    void act(() => output.props.onClick(event))
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(onClick).toHaveBeenCalledTimes(1)
    act(() => renderer.unmount())
  })

  it('marks disabled and pending states with React Aria semantics and suppresses action', () => {
    const onPress = vi.fn()
    const { renderer: disabledRenderer, button: disabledButton } = render(
      createElement(Button, { isDisabled: true, onPress, children: 'Disabled' }),
    )
    const disabled = host(disabledRenderer)
    expect(disabled.props).toMatchObject({
      disabled: true,
      'data-disabled': true,
    })
    void act(() =>
      disabled.props.onClick({
        button: 0,
        currentTarget: disabledButton,
        target: disabledButton,
        nativeEvent: { detail: 0, pointerType: '' },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      }),
    )
    expect(onPress).not.toHaveBeenCalled()
    act(() => disabledRenderer.unmount())

    const { renderer: pendingRenderer } = render(
      createElement(Button, { isPending: true, children: 'Pending' }),
    )
    expect(host(pendingRenderer).props).toMatchObject({
      'aria-disabled': 'true',
      'data-pending': true,
    })
    act(() => pendingRenderer.unmount())
  })
})
