'use client'
import { useContext, useLayoutEffect, useRef, type ReactNode } from 'react'
import { animate } from 'motion'
import { DashGroupAncestryContext } from './structure.js'

export function AchievedMarker({
  position,
  pointer = 'arrow',
  children,
}: {
  position: number
  pointer?: 'arrow' | 'stem' | 'none'
  children: ReactNode
}) {
  const { visible } = useContext(DashGroupAncestryContext)
  const ref = useRef<HTMLSpanElement>(null)
  const painted = useRef<number | null>(null)
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const media = node.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)')
    const paint = (value: number) => {
      painted.current = value
      node.style.setProperty('--_picodash-achieved-position', `${value}%`)
      node.style.setProperty('--_picodash-achieved-label-offset', `${-value}%`)
      node.style.setProperty('--_picodash-achieved-ratio', String(value / 100))
    }
    let motion: ReturnType<typeof animate> | undefined
    const snap = () => {
      motion?.stop()
      paint(position)
    }
    if (painted.current === null || media?.matches || !visible) snap()
    else
      motion = animate(painted.current, position, {
        duration: 0.18,
        ease: [0.22, 1, 0.36, 1],
        onUpdate: paint,
      })
    const changed = () => {
      if (media?.matches) snap()
    }
    media?.addEventListener('change', changed)
    return () => {
      motion?.stop()
      media?.removeEventListener('change', changed)
    }
  }, [position, visible])
  return (
    <span ref={ref} aria-hidden="true" data-picodash-achieved-marker>
      <span aria-hidden="true" data-picodash-achieved-pointer={pointer} />
      <span data-picodash-achieved-readout>{children}</span>
    </span>
  )
}
