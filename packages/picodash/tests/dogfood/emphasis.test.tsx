// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { fireEvent, getByRole } from '@testing-library/react'
import { expect, it } from 'vite-plus/test'
import { createSettings } from './Controls.js'
import { Emphasis } from './Emphasis.js'

it('ships emphasis through the facade without blocking the bound control', () => {
  const nexus = createSettings()
  const element = document.createElement('div')
  document.body.append(element)
  const root = createRoot(element)
  try {
    act(() => root.render(<Emphasis nexus={nexus} />))
    expect(element.querySelector('[data-band][data-glow][data-tint]')).not.toBeNull()
    act(() => {
      fireEvent.click(getByRole(element, 'switch', { name: 'Enabled' }))
    })
    expect(nexus.getState().values.enabled).toBe(false)
  } finally {
    act(() => root.unmount())
    element.remove()
    nexus.destroy()
  }
})
