// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { createPicodashNexus } from '@picodash/nexus'
import { DashStack, Dashlet, RangeDashlet } from '../src/index.js'
import { RangeSlider } from '../src/ui.js'

afterEach(cleanup)

describe('independent Range outcomes', () => {
  it.each([false, true])(
    'retains the clicked endpoint instead of redirecting it to Start (detent=%s)',
    (detent) => {
      const nexus = createPicodashNexus({ valueOwner: 'nexus', fields: {} })
      const view = render(
        <DashStack id="focus" nexus={nexus}>
          <Dashlet id="range" label="Range">
            <RangeSlider
              aria-label="Range control"
              value={{ start: 3, end: 10 }}
              onChange={() => {}}
              min={2}
              max={12}
              endDetent={detent ? { value: 13, label: 'Any' } : undefined}
            />
          </Dashlet>
        </DashStack>,
      )
      const [start, end] = screen.getAllByRole('slider')
      act(() => end!.focus())
      fireEvent.click(end!.closest('[data-picodash-range-end]')!)
      expect(document.activeElement).toBe(end)
      // Detent pointer capture can retarget the release click to the control root.
      fireEvent.click(view.container.querySelector('.picodash-dashstack-range-slider')!)
      expect(document.activeElement).toBe(end)
      fireEvent.click(view.container.querySelector('[data-picodash-dashlet-label]')!)
      expect(document.activeElement).toBe(start)
      view.unmount()
      nexus.destroy()
    },
  )

  it.each([false, true])('preserves bounds through result states (detent=%s)', (detent) => {
    const onChange = vi.fn()
    const props = {
      'aria-label': 'Planets',
      value: { start: 3, end: 10 },
      onChange,
      min: 2,
      max: 12,
      endDetent: detent ? { value: 13, label: 'Any' } : undefined,
      formatResult: (value: number) => `${value} planets`,
    }
    const view = render(<RangeSlider {...props} result={{ status: 'ready', value: 2 }} />)
    const marker = () => view.container.querySelector('[data-picodash-achieved-marker]')
    expect(screen.getByRole('status', { name: 'Actual' }).textContent).toBe('2 planets')
    expect(marker()).not.toBeNull() // Below the requested min is still a valid scale position.
    for (const slider of screen.getAllByRole('slider')) {
      const ids = slider.getAttribute('aria-describedby')?.split(' ') ?? []
      expect(
        ids.some((id) => document.getElementById(id)?.textContent?.includes('2 planets')),
      ).toBe(true)
    }
    view.rerender(<RangeSlider {...props} result={{ status: 'pending', lastValue: 2 }} />)
    expect(marker()).not.toBeNull()
    expect(screen.getByText('Calculating')).toBeTruthy()
    view.rerender(<RangeSlider {...props} result={{ status: 'ready', value: 14 }} />)
    expect(marker()).toBeNull()
    expect(screen.getByRole('status', { name: 'Actual' }).textContent).toContain(
      '14 planets · outside scale',
    )
    view.rerender(<RangeSlider {...props} result={{ status: 'no-fit' }} />)
    expect(screen.getByText('No match')).toBeTruthy()
    expect(screen.queryByRole('status', { name: 'Actual' })).toBeNull()
    view.rerender(
      <RangeSlider {...props} result={{ status: 'error', message: 'Solver unavailable' }} />,
    )
    expect(screen.getByText('Solver unavailable')).toBeTruthy()
    view.rerender(<RangeSlider {...props} result={{ status: 'pending' }} />)
    expect(marker()).toBeNull()
    view.rerender(<RangeSlider {...props} />)
    expect(view.container.querySelector('[data-result]')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
    expect((screen.getAllByRole('slider')[0] as HTMLInputElement).value).toBe(detent ? '1' : '3')
  })

  it('places exact detent results at their stop and rejects nonfinite outcomes', () => {
    const props = {
      value: { start: 2, end: 13 },
      onChange: vi.fn(),
      min: 2,
      max: 12,
      endDetent: { value: 13, label: 'Any' },
      'aria-label': 'Count',
    }
    const view = render(<RangeSlider {...props} result={{ status: 'ready', value: 13 }} />)
    expect(screen.getByRole('status', { name: 'Actual' }).textContent).toBe('Any')
    expect(
      view.container.querySelector('[data-picodash-range-result-scale="detent"]'),
    ).not.toBeNull()
    expect(() =>
      view.rerender(<RangeSlider {...props} result={{ status: 'ready', value: Infinity }} />),
    ).toThrow('Actual values must be finite')
  })

  it('forwards the ready-made result without writing Nexus, retaining endpoint edits and read-only behavior', async () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { range: { defaultValue: { start: 3, end: 10 } } },
    })
    const writes = vi.fn()
    const unsubscribe = nexus.subscribe(writes)
    const content = (value: number, readOnly = false) => (
      <DashStack id="test" nexus={nexus}>
        <RangeDashlet
          id="range"
          field={nexus.fields.range}
          label="Planets"
          min={2}
          max={12}
          result={{ status: 'ready', value }}
          formatResult={(n) => `${n} planets`}
          readOnly={readOnly}
        />
      </DashStack>
    )
    const view = render(content(4))
    view.rerender(content(6))
    expect(screen.getByRole('status', { name: 'Actual' }).textContent).toBe('6 planets')
    expect(writes).not.toHaveBeenCalled()
    const start = screen.getAllByRole('slider')[0]!
    act(() => {
      fireEvent.keyDown(start, { key: 'ArrowRight' })
      fireEvent.keyUp(start, { key: 'ArrowRight' })
    })
    expect(nexus.getState().values.range).toEqual({ start: 4, end: 10 })
    await act(async () => {})
    view.rerender(content(6, true))
    act(() => {
      fireEvent.keyDown(start, { key: 'ArrowRight' })
      fireEvent.keyUp(start, { key: 'ArrowRight' })
    })
    expect(nexus.getState().values.range).toEqual({ start: 4, end: 10 })
    view.unmount()
    unsubscribe()
    nexus.destroy()
  })
})

it('shows only scale boundary/detent dots, preserving the separate actual pointer and thumb controls', () => {
  const props = { value: { start: 6, end: 13 }, onChange: vi.fn(), min: 2, max: 12, step: 1 }
  const view = render(
    <RangeSlider
      {...props}
      endDetent={{ value: 13, label: 'Any' }}
      result={{ status: 'ready', value: 4 }}
    />,
  )
  const dots = () => [
    ...view.container.querySelectorAll<HTMLElement>('[data-picodash-range-reference-mark]'),
  ]
  expect(dots()).toHaveLength(3)
  expect(dots().map((dot) => dot.style.insetInlineStart)).toEqual([
    'calc(var(--_picodash-detent-start) + (100% - var(--_picodash-detent-start) - var(--_picodash-detent-end)) * 0)',
    'calc(var(--_picodash-detent-start) + (100% - var(--_picodash-detent-start) - var(--_picodash-detent-end)) * 1)',
    '100%',
  ])
  expect(
    view.container
      .querySelector('[data-picodash-range-reference-marks]')
      ?.getAttribute('aria-hidden'),
  ).toBe('true')
  expect(
    view.container
      .querySelector('[data-picodash-achieved-pointer]')
      ?.getAttribute('data-picodash-achieved-pointer'),
  ).toBe('arrow')
  expect(screen.getAllByRole('slider')).toHaveLength(2)
  expect(screen.getByLabelText('Actual').textContent).toBe('4')
  view.rerender(
    <RangeSlider
      {...props}
      startDetent={{ value: 0, label: 'Off' }}
      endDetent={{ value: 13, label: 'Any' }}
    />,
  )
  expect(dots()).toHaveLength(4)
  view.rerender(<RangeSlider {...props} value={{ start: 6, end: 12 }} />)
  expect(dots().map((dot) => dot.style.insetInlineStart)).toEqual(['0%', '100%'])
  view.rerender(<RangeSlider {...props} min={6} max={6} value={{ start: 6, end: 6 }} />)
  expect(dots()).toHaveLength(1)
  expect(props.onChange).not.toHaveBeenCalled()
})
