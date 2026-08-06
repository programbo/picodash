import { createElement, createRef } from 'react'
import { describe, it } from 'vite-plus/test'
import { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from '../src/index.tsx'

describe('@picodash/ui Button types', () => {
  it('accepts the React Aria surface and rejects product or retired props', () => {
    const variant: ButtonVariant = 'destructive'
    const size: ButtonSize = 'xs'
    const props: ButtonProps = {
      children: 'Save',
      variant,
      size,
      iconOnly: true,
      isDisabled: false,
      isPending: false,
      onPress: () => {},
      onClick: () => {},
      ref: createRef<HTMLButtonElement>(),
    }
    void props
    void createElement(Button, props)

    // @ts-expect-error Button has no duplicate native disabled prop.
    const disabled: ButtonProps = { children: 'No', disabled: true }
    void disabled
    // @ts-expect-error href/link behavior is not part of Button.
    const href: ButtonProps = { children: 'No', href: '/settings' }
    void href
    // @ts-expect-error polymorphic wrappers are not part of Button.
    const asChild: ButtonProps = { children: 'No', asChild: true }
    void asChild
    // @ts-expect-error retired variant.
    const subtle: ButtonProps = { children: 'No', variant: 'subtle' }
    void subtle
    // @ts-expect-error retired variant.
    const link: ButtonProps = { children: 'No', variant: 'link' }
    void link
    // @ts-expect-error retired variant.
    const defaultVariant: ButtonProps = { children: 'No', variant: 'default' }
    void defaultVariant
    // @ts-expect-error icon is not a size.
    const icon: ButtonProps = { children: 'No', size: 'icon' }
    void icon
    // @ts-expect-error icon sizes are not part of the size union.
    const iconSm: ButtonProps = { children: 'No', size: 'icon-sm' }
    void iconSm
    // @ts-expect-error product state does not belong to the shared primitive.
    const store: ButtonProps = { children: 'No', store: {} }
    void store
  })
})
