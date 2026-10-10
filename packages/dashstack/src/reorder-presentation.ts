import { animate } from 'motion'

/** Read the settled layout slot, excluding our transient reorder transform. */
export function reorderLayoutRect(element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  const view = element.ownerDocument?.defaultView
  const transform = view?.getComputedStyle(element).transform
  const offset = transform && transform !== 'none' ? new DOMMatrixReadOnly(transform).m42 : 0
  return { top: rect.top - offset, bottom: rect.bottom - offset }
}

export function createReorderPresentation(
  handle: HTMLElement,
  ids: readonly string[],
  pointerY?: number,
  onScroll?: () => void,
) {
  const list = handle.closest('[role="list"]')
  const activeNode = handle.closest<HTMLElement>('[role="listitem"]')
  const view = handle.ownerDocument?.defaultView
  if (!list || !activeNode || !view) return undefined
  const active = activeNode
  const nodes = [...list.querySelectorAll<HTMLElement>('[role="listitem"]')].filter(
    (node) =>
      node.closest('[role="list"]') === list &&
      ids.includes(
        node.getAttribute('data-picodash-dashlet') ??
          node.getAttribute('data-picodash-dashgroup') ??
          '',
      ),
  )
  // Pins constrain order, not the scroll owner. Single-lane modes scroll the root
  // list; short-Stack fallback scrolls the Stack itself.
  let scrollport: HTMLElement | null = handle.parentElement
  while (scrollport && !/^(auto|scroll)$/.test(view.getComputedStyle(scrollport).overflowY))
    scrollport = scrollport.parentElement
  const slotTop = (node: HTMLElement) => reorderLayoutRect(node).top + (scrollport?.scrollTop ?? 0)
  const slots = new Map(nodes.map((node) => [node, slotTop(node)]))
  const animations = new Map<HTMLElement, ReturnType<typeof animate>>()
  const originals = new Map(nodes.map((node) => [node, node.style.transform]))
  const grab = pointerY === undefined ? 0 : pointerY - active.getBoundingClientRect().top
  let y = pointerY
  let disposed = false
  let frame = 0
  active.setAttribute('data-picodash-reorder-active', '')
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)').matches
  const durationToken = view
    .getComputedStyle(active)
    .getPropertyValue('--picodash-duration-fast')
    .trim()
  const duration = Number.parseFloat(durationToken) / (durationToken.endsWith('ms') ? 1000 : 1)
  const stop = (node: HTMLElement) => {
    animations.get(node)?.stop()
    animations.delete(node)
  }
  function placeActive() {
    if (y === undefined) return
    const bounds = nodes.map(reorderLayoutRect)
    const top = Math.min(...bounds.map((rect) => rect.top))
    const bottom = Math.max(...bounds.map((rect) => rect.bottom))
    const slot = reorderLayoutRect(active)
    const desired = Math.max(top, Math.min(bottom - (slot.bottom - slot.top), y - grab))
    active.style.transform = `translateY(${desired - slot.top}px)`
  }
  function layout() {
    if (disposed) return
    for (const node of nodes) {
      const next = slotTop(node)
      const previous = slots.get(node) ?? next
      if (next !== previous) {
        const visual = node.getBoundingClientRect().top - reorderLayoutRect(node).top
        stop(node)
        if (node !== active || y === undefined) {
          const offset = previous - next + visual
          node.style.transform = `translateY(${offset}px)`
          const animation = animate(offset, 0, {
            duration: reduced ? 0 : duration,
            ease: [0.22, 1, 0.36, 1],
            onUpdate: (value) => {
              node.style.transform = `translateY(${value}px)`
            },
          })
          animations.set(node, animation)
        }
        slots.set(node, next)
      }
    }
    placeActive()
  }
  const tick = () => {
    if (disposed) return
    if (scrollport && y !== undefined) {
      const rect = scrollport.getBoundingClientRect()
      const style = view.getComputedStyle(scrollport)
      const top = rect.top + (Number.parseFloat(style.scrollPaddingTop) || 0)
      const bottom = rect.bottom - (Number.parseFloat(style.scrollPaddingBottom) || 0)
      const edge = Math.min(48, Math.max(0, bottom - top) / 4)
      const speed =
        y < top + edge
          ? -Math.min(12, (top + edge - y) / 3)
          : y > bottom - edge
            ? Math.min(12, (y - bottom + edge) / 3)
            : 0
      const previous = scrollport.scrollTop
      scrollport.scrollTop += speed
      if (scrollport.scrollTop !== previous) {
        placeActive()
        onScroll?.()
      }
    }
    frame = view.requestAnimationFrame(tick)
  }
  if (pointerY !== undefined) frame = view.requestAnimationFrame(tick)
  return {
    move(nextY: number) {
      y = nextY
      placeActive()
    },
    layout,
    finish() {
      if (disposed) return
      layout()
      disposed = true
      view.cancelAnimationFrame(frame)
      active.removeAttribute('data-picodash-reorder-active')
      for (const node of nodes) {
        stop(node)
        node.style.transform = originals.get(node) ?? ''
      }
    },
  }
}
