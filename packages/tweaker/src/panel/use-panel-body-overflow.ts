import { useEffect, type RefObject } from 'react'

export function usePanelBodyOverflow(
  bodyRef: RefObject<HTMLDivElement | null>,
  collapsed: boolean,
  controlsLength: number,
  sectionOrder: string[],
  hiddenSections: Record<string, boolean>,
) {
  useEffect(() => {
    const bodyElement = bodyRef.current
    if (!bodyElement || collapsed) return
    const scrollContainer: HTMLDivElement = bodyElement

    function updateOverflowState() {
      const overflowing =
        scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight > 1
      scrollContainer.toggleAttribute('data-overflowing', overflowing)
    }

    updateOverflowState()
    scrollContainer.addEventListener('scroll', updateOverflowState, { passive: true })
    window.addEventListener('resize', updateOverflowState)

    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateOverflowState)
    resizeObserver?.observe(scrollContainer)
    for (const child of scrollContainer.children) resizeObserver?.observe(child)

    return () => {
      scrollContainer.removeEventListener('scroll', updateOverflowState)
      window.removeEventListener('resize', updateOverflowState)
      resizeObserver?.disconnect()
      scrollContainer.removeAttribute('data-overflowing')
    }
  }, [bodyRef, collapsed, controlsLength, sectionOrder, hiddenSections])
}
