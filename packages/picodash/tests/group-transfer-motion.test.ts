// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vite-plus/test'
import { animate } from 'motion'
import { createGroupTransferMotion } from '../src/group-transfer-motion.ts'

vi.mock('motion', () => ({ animate: vi.fn(() => ({ stop: vi.fn() })) }))
afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

function fixture(reduced = false) {
  const change = vi.fn()
  const remove = vi.fn()
  vi.stubGlobal('matchMedia', () => ({
    matches: reduced,
    addEventListener: change,
    removeEventListener: remove,
  }))
  const home = document.createElement('div')
  const group = document.createElement('div')
  const panel = document.createElement('aside')
  panel.style.transform = 'translateX(2px)'
  panel.style.transformOrigin = 'center'
  vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 200, 300, 400))
  const motion = createGroupTransferMotion(home, group)
  return { motion, panel, remove }
}

it('requests both flight directions and fences stale completion while restoring owned styles', () => {
  const { motion, panel, remove } = fixture()
  const origin = new DOMRect(20, 50, 150, 100)
  motion.depart(panel, origin)
  expect(panel.getAttribute('data-picodash-group-flight')).toBe('detach')
  const first = vi.mocked(animate).mock.calls[0]!
  expect(first[0]).toBe(panel)
  expect(first[1]).toEqual({
    transform: ['translate3d(-80px, -150px, 0) scale(0.5) translateX(2px)', 'translateX(2px)'],
  })
  expect(first[2]).toMatchObject({ duration: 0.24, ease: [0.4, 0, 0.2, 1] })
  const previousEnd = (first[2] as { onComplete: () => void }).onComplete
  const complete = vi.fn()
  motion.returning(panel, origin, complete)
  expect(panel.getAttribute('data-picodash-group-flight')).toBe('return')
  const returning = vi.mocked(animate).mock.calls[1]!
  expect(returning[1]).toEqual({
    transform: ['translateX(2px)', 'translate3d(-80px, -150px, 0) scale(0.5) translateX(2px)'],
  })
  previousEnd()
  expect(complete).not.toHaveBeenCalled()
  expect(panel.getAttribute('data-picodash-group-flight')).toBe('return')
  const currentEnd = (returning[2] as { onComplete: () => void }).onComplete
  currentEnd()
  expect(complete).toHaveBeenCalledOnce()
  expect(panel.hasAttribute('data-picodash-group-flight')).toBe(false)
  expect(panel.style.transform).toBe('translateX(2px)')
  expect(panel.style.transformOrigin).toBe('center')
  motion.dispose()
  expect(remove).toHaveBeenCalledWith('change', expect.any(Function))
})

it('completes reduced-motion returns without requesting an animation', () => {
  const { motion, panel } = fixture(true)
  const complete = vi.fn()
  motion.returning(panel, new DOMRect(20, 50, 150, 100), complete)
  expect(animate).not.toHaveBeenCalled()
  expect(complete).toHaveBeenCalledOnce()
  expect(panel.hasAttribute('data-picodash-group-flight')).toBe(false)
  motion.dispose()
})
