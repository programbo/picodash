import { animate } from 'motion'

/** Feedback never holds up keyboard input, semantic state, or reduced-motion users. */
export function feedbackDuration(element: HTMLElement): number | undefined {
  const view = element.ownerDocument.defaultView
  if (!view || view.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
  const root = element.getRootNode()
  const active = 'activeElement' in root ? (root as Document | ShadowRoot).activeElement : null
  if (active?.matches(':focus-visible')) return undefined
  const token = view.getComputedStyle(element).getPropertyValue('--picodash-duration-fast').trim()
  const duration = Number.parseFloat(token) / (token.endsWith('ms') ? 1000 : 1)
  return Number.isFinite(duration) && duration > 0 ? duration : undefined
}

type DisclosureMotion =
  | { kind: 'idle' }
  | { kind: 'pending'; from: number }
  | { kind: 'animating'; animation: ReturnType<typeof animate> }

/** Paint-only lifecycle. React owns hidden/inert/ARIA and focus independently. */
export function createDisclosureFeedback(content: HTMLElement) {
  let state: DisclosureMotion = { kind: 'idle' }
  const blockSize = content.style.getPropertyValue('block-size')
  const priority = content.style.getPropertyPriority('block-size')
  const display = content.style.getPropertyValue('display')
  const displayPriority = content.style.getPropertyPriority('display')
  const media = content.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)')
  function stop() {
    if (state.kind === 'animating') state.animation.stop()
    state = { kind: 'idle' }
    content.removeAttribute('data-picodash-disclosure-motion')
    if (blockSize) content.style.setProperty('block-size', blockSize, priority)
    else content.style.removeProperty('block-size')
    if (display) content.style.setProperty('display', display, displayPriority)
    else content.style.removeProperty('display')
  }
  const onPreference = () => {
    if (media?.matches) stop()
  }
  media?.addEventListener('change', onPreference)
  const group = content.parentElement
  group?.addEventListener('keydown', stop)
  return {
    prepare() {
      const from = content.getBoundingClientRect().height
      stop()
      state = { kind: 'pending', from }
    },
    play(collapsed: boolean) {
      if (state.kind !== 'pending') return
      const from = state.from
      const duration = feedbackDuration(content)
      stop()
      if (duration === undefined) return
      content.setAttribute('data-picodash-disclosure-motion', '')
      // Tailwind preflight gives [hidden] an important display rule. Keep ARIA/inert
      // immediate while allowing this explicitly bounded closing paint to remain visible.
      content.style.setProperty('display', 'grid', 'important')
      const to = collapsed ? 0 : content.getBoundingClientRect().height
      if (Math.abs(from - to) < 0.5) {
        stop()
        return
      }
      const animation = animate(
        content,
        { blockSize: [`${from}px`, `${to}px`] },
        {
          duration,
          ease: [0.22, 1, 0.36, 1],
          onComplete: stop,
        },
      )
      state = { kind: 'animating', animation }
    },
    dispose() {
      stop()
      media?.removeEventListener('change', onPreference)
      group?.removeEventListener('keydown', stop)
    },
  }
}

/** Snapshot before removal; only the surviving, still-interactive chips move. */
export function createChipFeedback(list: HTMLElement) {
  let positions = new Map<HTMLElement, DOMRect>()
  const animations = new Map<
    HTMLElement,
    { animation: ReturnType<typeof animate>; translate: string }
  >()
  const media = list.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)')
  function stop() {
    for (const [node, { animation, translate }] of animations) {
      animation.stop()
      node.style.translate = translate
    }
    animations.clear()
  }
  const onPreference = () => {
    if (media?.matches) {
      positions.clear()
      stop()
    }
  }
  media?.addEventListener('change', onPreference)
  const onKeyDown = () => {
    positions.clear()
    stop()
  }
  list.addEventListener('keydown', onKeyDown)
  function play() {
    const previous = positions
    positions = new Map()
    const duration = feedbackDuration(list)
    if (duration === undefined) {
      stop()
      return
    }
    for (const [node, from] of previous) {
      if (!list.contains(node)) continue
      const to = node.getBoundingClientRect()
      const x = from.x - to.x
      const y = from.y - to.y
      if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5) continue
      const translate = node.style.translate
      const animation = animate(
        node,
        { translate: [`${x}px ${y}px`, '0px 0px'] },
        {
          duration,
          ease: [0.22, 1, 0.36, 1],
          onComplete: () => {
            node.style.translate = translate
            animations.delete(node)
          },
        },
      )
      animations.set(node, { animation, translate })
    }
  }
  const observer = new MutationObserver(play)
  observer.observe(list, { childList: true })
  return {
    prepare() {
      positions = new Map(
        [...list.querySelectorAll<HTMLElement>('[role="row"]')].map((node) => [
          node,
          node.getBoundingClientRect(),
        ]),
      )
      stop()
    },
    dispose() {
      observer.disconnect()
      stop()
      positions.clear()
      media?.removeEventListener('change', onPreference)
      list.removeEventListener('keydown', onKeyDown)
    },
  }
}
