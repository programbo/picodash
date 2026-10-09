import { animate } from 'motion'

/** Empty home-slot feedback never duplicates editors or delays semantic relocation. */
export function createGroupTransferMotion(home: HTMLElement, group: HTMLElement) {
  const media = home.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)')
  let gap: ReturnType<typeof animate> | undefined
  let flight: ReturnType<typeof animate> | undefined
  let previewHeight = 0
  function stopGap() {
    gap?.stop()
    gap = undefined
    home.style.removeProperty('height')
    home.style.removeProperty('display')
    home.style.minHeight = previewHeight ? `${previewHeight}px` : ''
  }
  function stopFlight() {
    flight?.stop()
    flight = undefined
    group.style.removeProperty('translate')
    group.style.removeProperty('opacity')
  }
  const stop = () => {
    stopGap()
    stopFlight()
  }
  const preference = () => {
    if (media?.matches) stop()
  }
  media?.addEventListener('change', preference)
  return {
    gap(from: number, to: number) {
      previewHeight = to
      stopGap()
      if (media?.matches || Math.abs(from - to) < 0.5) return
      home.style.display = 'block'
      home.style.minHeight = '0'
      gap = animate(
        home,
        { height: [`${from}px`, `${to}px`] },
        {
          duration: 0.2,
          ease: [0.22, 1, 0.36, 1],
          onComplete: stopGap,
        },
      )
    },
    inline(from: DOMRect | null) {
      previewHeight = 0
      stop()
      if (!from || media?.matches) return
      const to = group.getBoundingClientRect()
      flight = animate(
        group,
        {
          translate: [`${from.left - to.left}px ${from.top - to.top}px`, '0px 0px'],
          opacity: [0.65, 1],
        },
        { duration: 0.22, ease: [0.2, 0.8, 0.2, 1], onComplete: stopFlight },
      )
    },
    dispose() {
      previewHeight = 0
      stop()
      media?.removeEventListener('change', preference)
    },
  }
}
