// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { fireEvent, getByRole } from '@testing-library/react'
import { expect, it } from 'vite-plus/test'
import { createNumericTarget, NumericTargetRecipe } from './NumericTarget.js'

it('keeps numeric drafts separate from the accepted readout and forwards edit policies', () => {
  const nexus = createNumericTarget()
  const element = document.createElement('div')
  document.body.append(element)
  const root = createRoot(element)
  const render = (disabled = false, readOnly = false) =>
    act(() => root.render(createElement(NumericTargetRecipe, { nexus, disabled, readOnly })))
  try {
    render()
    const input = element.querySelector('input')
    if (!input) throw new Error('Missing numeric input')
    act(() => {
      fireEvent.change(input, { target: { value: '-' } })
    })
    expect(input.value).toBe('-')
    expect(nexus.getState().values.module).toBe(1.5)
    act(() => {
      fireEvent.change(input, { target: { value: '4' } })
      fireEvent.blur(input)
    })
    expect(input.value).toContain('4')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(nexus.getState().values.module).toBe(1.5)
    expect(element.textContent).toContain('Accepted 1.5 mm · Achieved 1.5 mm')
    const errorId = input.getAttribute('aria-errormessage')
    expect(errorId && document.getElementById(errorId)?.textContent).toContain('between 0.6 and 3')
    act(() => {
      fireEvent.change(input, { target: { value: '' } })
      fireEvent.blur(input)
    })
    expect(input.value).toBe('')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(nexus.getState().values.module).toBe(1.5)
    render(false, true)
    expect(input.readOnly).toBe(true)
    expect(input.value).toBe('')
    act(() => {
      fireEvent.click(getByRole(element, 'button', { name: 'Discard draft' }))
    })
    expect(input.value).toContain('1.5')
    render(true)
    expect(input.disabled).toBe(true)
    render()
    act(() => {
      fireEvent.change(input, { target: { value: '1.6' } })
      fireEvent.blur(input)
    })
    expect(nexus.getState().values.module).toBe(1.6)
    expect(element.textContent).toContain('Accepted 1.6 mm · Achieved 1.5 mm')
    expect(input.getAttribute('aria-invalid')).not.toBe('true')
  } finally {
    act(() => root.unmount())
    element.remove()
    nexus.destroy()
  }
})
