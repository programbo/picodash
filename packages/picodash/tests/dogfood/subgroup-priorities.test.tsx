// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { fireEvent, getByRole, queryByRole } from '@testing-library/react'
import { getDashStackStructure } from '@picodash/dashstack'
import { expect, it } from 'vite-plus/test'
import { createTargets } from './LinkedControls.js'
import { SubgroupPriorities } from './SubgroupPriorities.js'

it('keeps parent groups fixed while the opted-in subgroup reorders its children', () => {
  const nexus = createTargets()
  const element = document.createElement('div')
  document.body.append(element)
  const root = createRoot(element)
  try {
    act(() => root.render(createElement(SubgroupPriorities, { nexus })))
    for (const name of ['Targets', 'Envelope', 'Outer diameter', 'Ring thickness']) {
      expect(queryByRole(element, 'button', { name: `Reorder ${name}` })).toBeNull()
    }
    const handle = getByRole(element, 'button', { name: 'Reorder Reduction' })
    for (const key of [' ', 'ArrowDown', 'Enter']) {
      act(() => {
        fireEvent.keyDown(handle, { key })
      })
    }
    const structure = getDashStackStructure(nexus.scope('priorities'))
    expect(structure.nodes.find((node) => node.id === 'targets')?.children).toEqual([
      'module',
      'reduction',
    ])
    expect(structure.nodes.find((node) => node.id === 'geometry')?.children).toEqual([
      'targets',
      'envelope',
    ])
    expect(structure.nodes.find((node) => node.id === 'envelope')?.children).toEqual([
      'diameter',
      'thickness',
    ])
  } finally {
    act(() => root.unmount())
    element.remove()
    nexus.destroy()
  }
})
