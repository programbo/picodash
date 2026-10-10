// @vitest-environment jsdom
import { act } from 'react'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { createPicodashNexus } from '@picodash/nexus'
import {
  DashStack,
  DashGroup,
  Dashlet,
  useDashStackStructure,
  useDashStackGroupOrder,
} from '../src/index.js'

afterEach(cleanup)
describe('organizational subgroups', () => {
  it('exposes committed hierarchy outside the Stack, preserves hidden descendants, and cancels nested reorder', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { value: { defaultValue: 1 } },
    })
    const scope = nexus.scope('designer')
    function Probe() {
      return (
        <output data-probe>
          {JSON.stringify({
            structure: useDashStackStructure(scope),
            order: useDashStackGroupOrder(scope, 'targets'),
          })}
        </output>
      )
    }
    const view = render(
      <>
        <Probe />
        <DashStack nexus={scope}>
          <DashGroup id="geometry" label="Geometry" labelColor="#c90" glow>
            <DashGroup id="targets" label="Targets">
              <Dashlet id="sun" label="Sun" field={nexus.fields.value} />
              <Dashlet id="ring" label="Ring" />
            </DashGroup>
          </DashGroup>
          <DashGroup id="footer" aria-label="Footer" pin="end">
            <Dashlet id="summary" label="Summary" />
          </DashGroup>
        </DashStack>
      </>,
    )
    const read = () => JSON.parse(view.container.querySelector('[data-probe]')!.textContent!)
    expect(
      view.container
        .querySelector('[data-picodash-dashgroup="geometry"]')
        ?.hasAttribute('data-glow'),
    ).toBe(true)
    expect(
      view.container
        .querySelector('[data-picodash-dashgroup="targets"]')
        ?.hasAttribute('data-glow'),
    ).toBe(false)
    expect(read().order).toEqual(['sun', 'ring'])
    expect(
      read().structure.nodes.map((node: { id: string; parentId: string | null; depth: number }) => [
        node.id,
        node.parentId,
        node.depth,
      ]),
    ).toEqual([
      ['geometry', null, 0],
      ['targets', 'geometry', 1],
      ['sun', 'targets', 2],
      ['ring', 'targets', 2],
      ['footer', null, 0],
      ['summary', 'footer', 1],
    ])
    expect(view.queryByRole('button', { name: 'Collapse group Targets' })).toBeNull()
    const grip = view.getByRole('button', { name: 'Reorder Sun' })
    fireEvent.keyDown(grip, { key: ' ' })
    fireEvent.keyDown(grip, { key: 'ArrowDown' })
    expect(read().order).toEqual(['sun', 'ring'])
    fireEvent.click(view.getByRole('button', { name: 'Collapse group Geometry' }))
    expect(read().structure.nodes.find((node: { id: string }) => node.id === 'sun').visible).toBe(
      false,
    )
    expect(scope.getState().scope?.dashStack?.groupOrders.has('targets') ?? false).toBe(false)
    fireEvent.click(view.getByRole('button', { name: 'Expand group Geometry' }))
    act(() => {
      scope.setDashStackGroupOrder('targets', ['ring', 'sun'])
    })
    expect(read().order).toEqual(['ring', 'sun'])
    expect(
      read().structure.nodes.find((node: { id: string }) => node.id === 'sun').fieldKeys,
    ).toEqual(['value'])
    view.unmount()
    nexus.destroy()
  })
  it('rejects a third group level', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { value: { defaultValue: 1 } },
    })
    expect(() =>
      render(
        <DashStack id="deep" nexus={nexus}>
          <DashGroup id="a" label="A">
            <DashGroup id="b" label="B">
              <DashGroup id="c" label="C" />
            </DashGroup>
          </DashGroup>
        </DashStack>,
      ),
    ).toThrow('one subgroup level')
    cleanup()
    nexus.destroy()
  })
})

describe('local ordering pins', () => {
  it('partitions each group, fences keyboard moves, preserves cancelled order and reconciles changed pins', () => {
    const nexus = createPicodashNexus({ valueOwner: 'nexus', fields: {} })
    const scope = nexus.scope('local-pins')
    function Example({
      pin = 'end',
      groupPin = 'start',
    }: {
      pin?: 'start' | 'end'
      groupPin?: 'start' | 'end'
    }) {
      return (
        <DashStack nexus={scope} reorderable={false}>
          <DashGroup id="parent" label="Parent" reorderable>
            <Dashlet id="footer" label="Footer" pin="end" />
            <DashGroup id="zone" aria-label="Zone" reorderable>
              <Dashlet id="last" label="Last" pin={pin} />
              <Dashlet id="a" label="A" />
              <Dashlet id="first" label="First" pin="start" />
              <Dashlet id="b" label="B" />
            </DashGroup>
            <DashGroup id="heading" label="Heading" pin={groupPin} />
          </DashGroup>
        </DashStack>
      )
    }
    const view = render(<Example />)
    const order = (id: string) =>
      Array.from(
        view.container.querySelectorAll(
          `[data-picodash-dashgroup="${id}"] > [role="group"] > [data-picodash-dashgroup-list] > [role="listitem"]`,
        ),
      ).map(
        (node) =>
          node.getAttribute('data-picodash-dashlet') ??
          node.getAttribute('data-picodash-dashgroup'),
      )
    expect(order('parent')).toEqual(['heading', 'zone', 'footer'])
    expect(order('zone')).toEqual(['first', 'a', 'b', 'last'])
    expect(view.queryByRole('button', { name: 'Reorder First' })).toBeNull()
    const grip = view.getByRole('button', { name: 'Reorder A' })
    fireEvent.keyDown(grip, { key: 'Enter' })
    fireEvent.keyDown(grip, { key: 'End' })
    fireEvent.keyDown(grip, { key: 'ArrowDown' })
    fireEvent.keyDown(grip, { key: 'Enter' })
    expect(order('zone')).toEqual(['first', 'b', 'a', 'last'])
    expect(scope.getState().scope?.dashStack?.groupOrders.get('zone')).toEqual([
      'first',
      'b',
      'a',
      'last',
    ])
    fireEvent.keyDown(grip, { key: 'Enter' })
    fireEvent.keyDown(grip, { key: 'Home' })
    fireEvent.keyDown(grip, { key: 'Escape' })
    expect(order('zone')).toEqual(['first', 'b', 'a', 'last'])
    view.rerender(<Example pin="start" />)
    expect(order('zone')).toEqual(['first', 'last', 'b', 'a'])
    expect(order('parent')).toEqual(['heading', 'zone', 'footer'])
    view.rerender(<Example pin="start" groupPin="end" />)
    expect(order('parent')).toEqual(['zone', 'footer', 'heading'])
    view.unmount()
    nexus.destroy()
  })
})
