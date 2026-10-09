// @vitest-environment jsdom
import { act, type CSSProperties } from 'react'
import { createRoot } from 'react-dom/client'
import { fireEvent } from '@testing-library/react'
import { expect, it } from 'vite-plus/test'
import { createPicodashNexus } from '@picodash/nexus'
import { DashStack, Dashlet, TextDashlet } from '../src/index.js'

it('composes authored emphasis without changing values, focus, drafts, or native wrapper props', () => {
  const nexus = createPicodashNexus({
    valueOwner: 'nexus',
    fields: {
      text: {
        defaultValue: 'Ready',
        validate: (value: string) => (value ? [] : [{ message: 'Required' }]),
      },
    },
  })
  const element = document.createElement('div')
  document.body.append(element)
  const root = createRoot(element)
  const render = (
    band: boolean | CSSProperties['color'],
    glow: boolean | CSSProperties['color'],
    tint: boolean | CSSProperties['color'],
  ) =>
    act(() =>
      root.render(
        <DashStack id="emphasis" nexus={nexus}>
          <TextDashlet
            id="authored"
            label="Authored"
            field={nexus.fields.text}
            band={band}
            glow={glow}
            tint={tint}
            className="consumer-class"
            style={{ marginTop: 3 }}
          />
          <Dashlet id="plain" label="Plain">
            <span>Unchanged</span>
          </Dashlet>
        </DashStack>,
      ),
    )
  let writes = 0
  let unsubscribe = () => {}
  try {
    render(true, true, true)
    unsubscribe = nexus.subscribe(() => {
      writes += 1
    })
    const shell = element.querySelector<HTMLElement>(
      '[data-picodash-dashlet="authored"] [data-picodash-dashlet-shell]',
    )!
    const wrapper = shell.parentElement!
    const input = element.querySelector('input')!
    act(() => input.focus())
    expect(wrapper.classList.contains('consumer-class')).toBe(true)
    expect(wrapper.style.marginTop).toBe('3px')
    for (const treatment of ['band', 'glow', 'tint']) {
      expect(shell.getAttribute(`data-${treatment}`)).toBe('true')
      expect(shell.style.getPropertyValue(`--_picodash-dashlet-${treatment}`)).toBe(
        `var(--picodash-dashlet-${treatment}-color, var(--picodash-color-accent))`,
      )
      expect(wrapper.hasAttribute(treatment)).toBe(false)
    }
    render('#ffbc42', false, 'var(--brand)')
    expect(document.activeElement).toBe(input)
    expect(shell.style.getPropertyValue('--_picodash-dashlet-band')).toBe('#ffbc42')
    expect(shell.hasAttribute('data-glow')).toBe(false)
    expect(shell.style.getPropertyValue('--_picodash-dashlet-glow')).toBe('')
    expect(shell.style.getPropertyValue('--_picodash-dashlet-tint')).toBe('var(--brand)')
    expect(writes).toBe(0)
    expect(nexus.getState().values.text).toBe('Ready')
    act(() => {
      fireEvent.change(input, { target: { value: '' } })
    })
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const errorId = input.getAttribute('aria-errormessage')
    render(false, true, undefined)
    expect(input.value).toBe('')
    expect(input.getAttribute('aria-errormessage')).toBe(errorId)
    expect(nexus.getState().values.text).toBe('Ready')
    expect(shell.hasAttribute('data-band')).toBe(false)
    expect(shell.hasAttribute('data-tint')).toBe(false)
    expect(element.querySelector('[data-picodash-dashlet="plain"] [data-glow]')).toBeNull()
  } finally {
    unsubscribe()
    act(() => root.unmount())
    element.remove()
    nexus.destroy()
  }
})
