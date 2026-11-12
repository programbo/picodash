import { useLayoutEffect, useRef } from 'react'
import { animate } from 'motion/mini'
import { DashGroup, DashList, Dashlet } from '@picodash/dashlist'
import type { ResizeAccordionItem, ResizeLabConfiguration } from './resize-lab-model'

const paragraph =
  'A useful inspector keeps the controls you need close to the work. Changing its width reflows this paragraph, while changing its height makes the body scroll. The preferred size stays available when the container has room again.'

function TextContent({ count }: { readonly count: number }) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: count }, (_, index) => (
        <p key={index} className="max-w-prose text-sm leading-6">
          {paragraph}
        </p>
      ))}
    </div>
  )
}

function AccordionItem({
  item,
  transition,
  duration,
  onToggle,
}: {
  readonly item: ResizeAccordionItem
  readonly transition: boolean
  readonly duration: number
  readonly onToggle: (id: number) => void
}) {
  const clip = useRef<HTMLDivElement>(null)
  const natural = useRef<HTMLDivElement>(null)
  const mounted = useRef(false)
  const regionId = `resize-lab-accordion-${item.id}`

  useLayoutEffect(() => {
    const element = clip.current
    const content = natural.current
    if (!element || !content) return
    const from = element.hidden ? 0 : element.getBoundingClientRect().height
    element.hidden = false
    const to = item.open ? content.getBoundingClientRect().height : 0
    const reduce = element.ownerDocument.defaultView?.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    if (!mounted.current || !transition || duration === 0 || reduce || Math.abs(from - to) < 0.5) {
      element.style.blockSize = item.open ? 'auto' : '0px'
      element.hidden = !item.open
      mounted.current = true
      return
    }
    element.style.blockSize = `${from}px`
    element.dataset.resizeAccordionTransition = ''
    const animation = animate(
      element,
      { blockSize: [`${from}px`, `${to}px`] },
      {
        duration: duration / 1000,
        ease: 'easeOut',
        onComplete: () => {
          element.style.blockSize = item.open ? 'auto' : '0px'
          element.hidden = !item.open
          delete element.dataset.resizeAccordionTransition
        },
      },
    )
    return () => {
      animation.cancel()
      delete element.dataset.resizeAccordionTransition
    }
  }, [duration, item.open, item.paragraphs, transition])

  return (
    <section className="border-b border-(--picodash-color-border) last:border-b-0">
      <h3>
        <button
          aria-expanded={item.open}
          aria-controls={regionId}
          className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-(--picodash-color-surface-muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--picodash-color-focus)"
          onClick={() => onToggle(item.id)}
          type="button"
        >
          <span>Accordion item {item.id}</span>
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className="size-4 shrink-0 data-[open=true]:rotate-180"
            data-open={item.open}
            aria-hidden="true"
          >
            <path
              d="m5 7.5 5 5 5-5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </h3>
      <div
        ref={clip}
        id={regionId}
        aria-hidden={!item.open}
        inert={!item.open}
        data-collapsed={!item.open}
        className="overflow-hidden"
      >
        <div ref={natural} className="px-4 pt-1 pb-4">
          <TextContent count={item.paragraphs} />
        </div>
      </div>
    </section>
  )
}

export function ResizeLabContent({
  configuration,
  onToggleItem,
}: {
  readonly configuration: ResizeLabConfiguration
  readonly onToggleItem: (id: number) => void
}) {
  switch (configuration.content) {
    case 'fixed':
      return (
        <div className="p-4">
          <div
            role="img"
            aria-label={`Fixed content ${configuration.fixedWidth} by ${configuration.fixedHeight} pixels`}
            className="flex max-w-none items-center justify-center border border-dashed border-(--picodash-color-accent) bg-(--picodash-color-surface-muted) p-4 text-center text-sm"
            style={{ width: configuration.fixedWidth, height: configuration.fixedHeight }}
            data-resize-lab-fixed-content
          >
            <span className="font-mono tabular-nums">
              {configuration.fixedWidth} × {configuration.fixedHeight}
              <br />
              <span className="font-sans text-(--picodash-color-text-muted)">Fixed content</span>
            </span>
          </div>
        </div>
      )
    case 'text':
      return (
        <div className="p-4" data-resize-lab-wrapping-content>
          <TextContent count={configuration.textParagraphs} />
        </div>
      )
    case 'accordion':
      return (
        <div aria-label="Resizable accordion" data-resize-lab-accordion>
          {configuration.items.length === 0 ? (
            <p className="p-4 text-sm text-(--picodash-color-text-muted)">
              No items. Add a short or tall item from the content controls.
            </p>
          ) : (
            configuration.items.map((item) => (
              <AccordionItem
                key={item.id}
                item={item}
                transition={configuration.transition}
                duration={configuration.transitionDuration}
                onToggle={onToggleItem}
              />
            ))
          )}
        </div>
      )
    case 'list':
      return (
        <DashList title="Resize Lab pinned bands" headingLevel={3} reorderable>
          <Dashlet id="resize-start" label="Pinned start" pin="start">
            <p className="p-3 text-sm">This start band stays visible.</p>
          </Dashlet>
          <DashGroup id="resize-details" label="Details" collapsible>
            {Array.from({ length: configuration.textParagraphs }, (_, index) => (
              <Dashlet
                key={index}
                id={`resize-row-${index}`}
                label={`Detail ${index + 1}`}
                layout="full"
              >
                <p className="p-3 text-sm leading-6">{paragraph}</p>
              </Dashlet>
            ))}
          </DashGroup>
          <Dashlet id="resize-end" label="Pinned end" pin="end">
            <p className="p-3 text-sm">Only the middle band scrolls.</p>
          </Dashlet>
        </DashList>
      )
  }
}
