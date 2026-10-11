import { animate } from 'motion'

type FlightRect = Pick<DOMRect, 'left' | 'top' | 'width'>

/** Coordinate home-slot feedback and button flights without duplicating live editors. */
export function createGroupTransferMotion(home: HTMLElement, group: HTMLElement) {
  const media = home.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)')
  let gap: ReturnType<typeof animate> | undefined
  let flight: ReturnType<typeof animate> | undefined
  let previewHeight = 0
  let panelFlight: ReturnType<typeof animate> | undefined
  let cleanupPanel: (() => void) | undefined
  let completePanel: (() => void) | undefined
  let generation = 0
  function cancelPanelFlight() {
    generation++
    panelFlight?.stop()
    panelFlight = undefined
    cleanupPanel?.()
    cleanupPanel = undefined
    completePanel = undefined
  }
  function finishPanelFlight() {
    const complete = completePanel
    cancelPanelFlight()
    complete?.()
  }
  function fly(panel: HTMLElement, origin: FlightRect, arriving: boolean, complete?: () => void) {
    cancelPanelFlight()
    const rect = panel.getBoundingClientRect()
    if (media?.matches || !rect.width || !rect.height) {
      complete?.()
      return
    }
    const token = generation
    const previous = ['transform', 'transform-origin'].map((key) => ({
      key,
      value: panel.style.getPropertyValue(key),
    }))
    const interrupt = () => finishPanelFlight()
    cleanupPanel = () => {
      for (const { key, value } of previous) {
        if (value) panel.style.setProperty(key, value)
        else panel.style.removeProperty(key)
      }
      panel.removeAttribute('data-picodash-group-flight')
      panel.removeEventListener('pointerdown', interrupt, true)
    }
    completePanel = complete
    panel.style.transformOrigin = 'top left'
    panel.setAttribute('data-picodash-group-flight', arriving ? 'detach' : 'return')
    panel.addEventListener('pointerdown', interrupt, true)
    const base = panel.ownerDocument.defaultView?.getComputedStyle(panel).transform ?? 'none'
    const target = `translate3d(${origin.left - rect.left}px, ${origin.top - rect.top}px, 0) scale(${Math.max(origin.width, 1) / rect.width})${base === 'none' ? '' : ` ${base}`}`
    panelFlight = animate(
      panel,
      {
        transform: arriving ? [target, base] : [base, target],
      },
      {
        duration: 0.24,
        ease: [0.4, 0, 0.2, 1],
        onComplete: () => {
          if (generation === token) finishPanelFlight()
        },
      },
    )
  }
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
    cancelPanelFlight()
  }
  const preference = () => {
    if (media?.matches) {
      finishPanelFlight()
      stop()
    }
  }
  media?.addEventListener('change', preference)
  return {
    depart(panel: HTMLElement, from: DOMRect) {
      fly(panel, from, true)
    },
    returning(panel: HTMLElement, to: FlightRect, complete: () => void) {
      fly(panel, to, false, complete)
    },
    cancelFlight: cancelPanelFlight,
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
