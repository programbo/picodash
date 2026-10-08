// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createChipFeedback, createDisclosureFeedback } from '../src/feedback-motion.js'

const motion = vi.hoisted(() => ({
  calls: [] as Array<{
    node: HTMLElement
    frames: Record<string, string[]>
    options: { duration: number; onComplete: () => void }
    stop: ReturnType<typeof vi.fn>
  }>,
}))
vi.mock('motion', () => ({
  animate: (
    node: HTMLElement,
    frames: Record<string, string[]>,
    options: { duration: number; onComplete: () => void },
  ) => {
    const stop = vi.fn()
    motion.calls.push({ node, frames, options, stop })
    return { stop }
  },
}))

let reduced = false
let preference: EventTarget
beforeEach(() => {
  motion.calls.length = 0
  reduced = false
  preference = new EventTarget()
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    get matches() {
      return reduced
    },
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: preference.addEventListener.bind(preference),
    removeEventListener: preference.removeEventListener.bind(preference),
    dispatchEvent: preference.dispatchEvent.bind(preference),
  }))
})
afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})
function element() {
  const node = document.createElement('div')
  node.style.setProperty('--picodash-duration-fast', '150ms')
  document.body.append(node)
  return node
}
function rect(node: HTMLElement, y: number, height = 20) {
  vi.spyOn(node, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, y, 100, height))
}

describe('disclosure paint lifecycle', () => {
  it('keeps collapsed content hidden and inert while reversing from its current painted height', () => {
    const content = element()
    const child = document.createElement('input')
    content.append(child)
    rect(content, 0, 100)
    const feedback = createDisclosureFeedback(content)
    feedback.prepare()
    content.hidden = true
    content.inert = true
    content.setAttribute('aria-hidden', 'true')
    feedback.play(true)
    expect(motion.calls[0]?.frames.blockSize).toEqual(['100px', '0px'])
    expect(content.hidden).toBe(true)
    expect(content.inert).toBe(true)
    expect(content.contains(child)).toBe(true)

    rect(content, 0, 43)
    feedback.prepare()
    expect(motion.calls[0]?.stop).toHaveBeenCalledOnce()
    content.hidden = false
    content.inert = false
    content.removeAttribute('aria-hidden')
    rect(content, 0, 100)
    feedback.play(false)
    expect(motion.calls[1]?.frames.blockSize).toEqual(['43px', '100px'])
    motion.calls[1]?.options.onComplete()
    expect(content.hasAttribute('data-picodash-disclosure-motion')).toBe(false)
    expect(content.style.blockSize).toBe('')
    feedback.dispose()
  })

  it('settles immediately for reduced motion and cleans up an in-flight preference change', () => {
    const content = element()
    rect(content, 0, 100)
    const feedback = createDisclosureFeedback(content)
    reduced = true
    feedback.prepare()
    content.hidden = true
    feedback.play(true)
    expect(motion.calls).toHaveLength(0)
    expect(content.hasAttribute('data-picodash-disclosure-motion')).toBe(false)

    reduced = false
    feedback.prepare()
    feedback.play(true)
    expect(motion.calls).toHaveLength(1)
    reduced = true
    preference.dispatchEvent(new Event('change'))
    expect(motion.calls[0]?.stop).toHaveBeenCalledOnce()
    expect(content.hasAttribute('data-picodash-disclosure-motion')).toBe(false)
    expect(content.hidden).toBe(true)
    feedback.dispose()
  })
})

describe('chip reflow', () => {
  it('removes the deleted chip immediately and moves only surviving chips', async () => {
    const list = element()
    const first = document.createElement('div')
    const next = document.createElement('div')
    first.setAttribute('role', 'row')
    next.setAttribute('role', 'row')
    list.append(first, next)
    rect(first, 0)
    rect(next, 24)
    const feedback = createChipFeedback(list)
    feedback.prepare()
    first.remove()
    rect(next, 0)
    list.append(document.createTextNode(''))
    await Promise.resolve()
    expect(list.children).toHaveLength(1)
    expect(motion.calls).toHaveLength(1)
    expect(motion.calls[0]?.node).toBe(next)
    expect(motion.calls[0]?.frames.translate).toEqual(['0px 24px', '0px 0px'])
    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(motion.calls[0]?.stop).toHaveBeenCalledOnce()
    feedback.dispose()
    expect(next.style.translate).toBe('')
  })

  it('skips reduced-motion and keyboard reflow without delaying removal', async () => {
    const list = element()
    const chip = document.createElement('div')
    chip.setAttribute('role', 'row')
    list.append(chip)
    rect(chip, 24)
    const feedback = createChipFeedback(list)
    reduced = true
    feedback.prepare()
    rect(chip, 0)
    list.append(document.createTextNode(''))
    await Promise.resolve()
    expect(motion.calls).toHaveLength(0)
    reduced = false
    const focus = document.createElement('button')
    chip.append(focus)
    focus.focus()
    feedback.prepare()
    rect(chip, 24)
    list.append(document.createTextNode(''))
    await Promise.resolve()
    expect(motion.calls).toHaveLength(0)
    feedback.dispose()
  })
})
