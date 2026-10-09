import { useContext, useLayoutEffect, useRef, type RefObject } from 'react'
import { animate } from 'motion'
import { DashGroupAncestryContext } from './structure.js'

export const thumbSnapSpring = { type: 'spring' as const, stiffness: 1800, damping: 36, mass: 0.2 }
export const minimumStepPixels = 8

/** Animate paint only when a step is visibly separated; hit testing and values stay immediate. */
export function useSteppedThumbMotion(
  rootRef: RefObject<HTMLElement | null>,
  values: readonly number[],
  min: number,
  max: number,
  step: number,
  disabled: boolean,
) {
  const { visible } = useContext(DashGroupAncestryContext)
  const previous = useRef<{ values: readonly number[]; configuration: string } | null>(null)
  const configuration = JSON.stringify([min, max, step])
  useLayoutEffect(() => {
    const before = previous.current
    previous.current = { values, configuration }
    const root = rootRef.current
    const track = root?.querySelector<HTMLElement>('[data-picodash-step-track]')
    if (
      !root ||
      !track ||
      !before ||
      before.configuration !== configuration ||
      disabled ||
      !visible
    )
      return
    const media = root.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)')
    if (media?.matches || max <= min) return
    const width = track.getBoundingClientRect().width
    if ((width * step) / (max - min) < minimumStepPixels) return
    const direction = getComputedStyle(root).direction === 'rtl' ? -1 : 1
    const motions: ReturnType<typeof animate>[] = []
    const thumbs = root.querySelectorAll<HTMLElement>(
      '[data-picodash-dashstack-slider-thumb], [data-picodash-dashstack-range-slider-thumb]',
    )
    thumbs.forEach((thumb, index) => {
      const old = before.values[index],
        value = values[index]
      if (old === undefined || value === undefined || old === value) return
      // Limit settling feedback to a dragged or keyboard-focused thumb.
      if (!thumb.hasAttribute('data-dragging') && !thumb.hasAttribute('data-focus-visible')) return
      const offset = (((old - value) * width) / (max - min)) * direction
      thumb.style.setProperty('--_picodash-step-snap', `${offset}px`)
      motions.push(
        animate(offset, 0, {
          ...thumbSnapSpring,
          onUpdate: (x) => thumb.style.setProperty('--_picodash-step-snap', `${x}px`),
        }),
      )
    })
    const stop = () => {
      motions.forEach((m) => m.stop())
      thumbs.forEach((t) => t.style.removeProperty('--_picodash-step-snap'))
    }
    const changed = () => {
      if (media?.matches) stop()
    }
    media?.addEventListener('change', changed)
    return () => {
      stop()
      media?.removeEventListener('change', changed)
    }
  }, [values[0], values[1], configuration, disabled, visible, rootRef])
}
