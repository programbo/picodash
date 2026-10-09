// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { fireEvent, getByRole } from '@testing-library/react'
import { expect, it } from 'vite-plus/test'
import { createOpenCountNexus, OpenCountRangeRecipe, projectCountWindow } from './OpenCountRange.js'

it('projects Any without writes, commits atomic endpoint edits, and keeps unavailable intent', async () => {
  const nexus = createOpenCountNexus()
  const element = document.createElement('div')
  document.body.append(element)
  const root = createRoot(element)
  const render = (feasibleMax: number | null, achieved: number | null) =>
    act(() => root.render(createElement(OpenCountRangeRecipe, { nexus, feasibleMax, achieved })))
  let writes = 0
  const unsubscribe = nexus.subscribe(() => {
    writes += 1
  })
  try {
    render(8, 4)
    render(12, 4)
    expect(writes).toBe(0)
    expect(nexus.getState().values.counts).toEqual({ min: 3, max: null })
    expect(getByRole(element, 'slider', { name: /^End\b/ }).getAttribute('aria-valuetext')).toBe(
      'Any',
    )
    act(() => {
      fireEvent.keyDown(getByRole(element, 'slider', { name: /^Start\b/ }), { key: 'ArrowRight' })
      fireEvent.keyUp(getByRole(element, 'slider', { name: /^Start\b/ }), { key: 'ArrowRight' })
    })
    expect(nexus.getState().values.counts).toEqual({ min: 4, max: null })
    expect(writes).toBe(1)
    await act(async () => {})
    act(() => {
      fireEvent.keyDown(getByRole(element, 'slider', { name: /^End\b/ }), { key: 'ArrowLeft' })
      fireEvent.keyUp(getByRole(element, 'slider', { name: /^End\b/ }), { key: 'ArrowLeft' })
    })
    expect(nexus.getState().values.counts).toEqual({ min: 4, max: 12 })
    expect(writes).toBe(2)
    await act(async () => {})
    act(() => {
      fireEvent.keyDown(getByRole(element, 'slider', { name: /^End\b/ }), { key: 'ArrowRight' })
      fireEvent.keyUp(getByRole(element, 'slider', { name: /^End\b/ }), { key: 'ArrowRight' })
    })
    await act(async () => {})
    expect(nexus.getState().values.counts).toEqual({ min: 4, max: null })
    const before = writes
    render(2, null)
    render(null, null)
    expect(writes).toBe(before)
    expect(nexus.getState().values.counts.max).toBe(null)
    expect(getByRole(element, 'status', { name: 'Achieved planet count' }).textContent).toBe(
      'No feasible solution',
    )
    expect(projectCountWindow({ min: 3, max: 12 }, 8)).toEqual({
      value: { start: 3, end: 12 },
      scaleMax: 12,
      endDetent: { value: 13, label: 'Any' },
    })
    expect(nexus.setValue(nexus.fields.counts, { min: 4, max: Infinity }).ok).toBe(false)
  } finally {
    unsubscribe()
    act(() => root.unmount())
    element.remove()
    nexus.destroy()
  }
})
