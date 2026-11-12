'use client'

import { useCallback, type RefCallback } from 'react'

/** Attach to the actual vertical scrollport. All feedback stays local to its DOM. */
export function useScrollFade(): RefCallback<HTMLElement> {
  return useCallback((element) => {
    if (!element) return
    const ownerWindow = element.ownerDocument.defaultView
    const update = () => {
      const maximum = Math.max(0, element.scrollHeight - element.clientHeight)
      const position = Math.max(0, Math.min(maximum, element.scrollTop))
      const remaining = maximum - position
      const extent = Math.min(40, element.clientHeight / 4)
      const top = position > 1 ? extent * Math.min(1, position / 96) : 0
      const bottom = remaining > 1 ? extent * Math.min(1, remaining / 96) : 0
      for (const [edge, size] of [
        ['top', top],
        ['bottom', bottom],
      ] as const) {
        const name = `--_picodash-scroll-fade-${edge}`
        const value = `${size}px`
        if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value)
      }
      const overflow = [top > 0 ? 'start' : '', bottom > 0 ? 'end' : ''].filter(Boolean).join(' ')
      if (element.getAttribute('data-picodash-scroll-overflow') !== overflow)
        element.setAttribute('data-picodash-scroll-overflow', overflow)
    }
    const observer = ownerWindow?.ResizeObserver
      ? new ownerWindow.ResizeObserver(update)
      : undefined
    const observeContent = () => {
      observer?.disconnect()
      observer?.observe(element)
      // A constrained flex child can retain its box while a nested disclosure grows.
      for (const child of element.querySelectorAll('*')) observer?.observe(child)
    }
    const mutation = ownerWindow?.MutationObserver
      ? new ownerWindow.MutationObserver((records) => {
          // Mask writes do not change layout; viewport size changes are observed above.
          if (records.every((record) => record.target === element && record.type === 'attributes'))
            return
          if (records.some((record) => record.type === 'childList')) observeContent()
          update()
        })
      : undefined
    element.setAttribute('data-picodash-scroll-fade', '')
    observeContent()
    mutation?.observe(element, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    })
    element.addEventListener('scroll', update, { passive: true })
    element.addEventListener('load', update, true)
    element.addEventListener('error', update, true)
    update()
    return () => {
      observer?.disconnect()
      mutation?.disconnect()
      element.removeEventListener('scroll', update)
      element.removeEventListener('load', update, true)
      element.removeEventListener('error', update, true)
      element.removeAttribute('data-picodash-scroll-fade')
      element.removeAttribute('data-picodash-scroll-overflow')
      element.style.removeProperty('--_picodash-scroll-fade-top')
      element.style.removeProperty('--_picodash-scroll-fade-bottom')
    }
  }, [])
}
