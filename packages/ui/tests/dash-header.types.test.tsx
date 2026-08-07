import { createElement, createRef } from 'react'
import { describe, it } from 'vite-plus/test'
import { DashHeader, type DashHeaderProps, type DashHeaderSlots } from '../src/index.tsx'

describe('@picodash/ui DashHeader types', () => {
  it('accepts native div props and readonly slots while rejecting product surfaces', () => {
    const slots: Readonly<DashHeaderSlots> = {
      leading: 'Move',
      title: 'Inspector',
      actions: null,
      trailing: undefined,
    }
    const props: DashHeaderProps = {
      slots,
      id: 'header',
      className: 'header',
      style: { color: 'red' },
      title: 'Inspector tooltip',
      'aria-label': 'Inspector',
      onClick: () => {},
      ref: createRef<HTMLDivElement>(),
    }
    void props
    void createElement(DashHeader, props)

    // @ts-expect-error DashHeader requires slots instead of children.
    const children: DashHeaderProps = { children: 'Inspector', slots }
    void children
    // @ts-expect-error slots are required.
    const missingSlots: DashHeaderProps = {}
    void missingSlots
    // @ts-expect-error slots are readonly.
    slots.title = 'Changed'
    // @ts-expect-error slot values are not top-level props.
    const topLevelLeading: DashHeaderProps = { slots, leading: 'Move' }
    void topLevelLeading
    // @ts-expect-error slot values are not top-level props.
    const topLevelActions: DashHeaderProps = { slots, actions: 'Actions' }
    void topLevelActions
    // @ts-expect-error slot values are not top-level props.
    const topLevelTrailing: DashHeaderProps = { slots, trailing: 'Close' }
    void topLevelTrailing
    // @ts-expect-error polymorphic APIs are not part of DashHeader.
    const asChild: DashHeaderProps = { slots, asChild: true }
    void asChild
    // @ts-expect-error presentation variants are not part of DashHeader.
    const density: DashHeaderProps = { slots, density: 'compact' }
    void density
    // @ts-expect-error product behavior does not belong to the shared primitive.
    const drag: DashHeaderProps = { slots, draggable: true, onMove: () => {} }
    void drag
    // @ts-expect-error Store/product props are not part of DashHeader.
    const store: DashHeaderProps = { slots, store: {} }
    void store
  })
})
