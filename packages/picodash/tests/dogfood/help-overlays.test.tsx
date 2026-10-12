// @vitest-environment jsdom
import { act, useRef, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vite-plus/test'
import {
  Button,
  Popover,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  PicodashThemeProvider,
} from '@picodash/ui'

function RichHelp() {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  return (
    <>
      <Button ref={trigger} aria-expanded={open} onPress={() => setOpen(true)}>
        Open rich help
      </Button>
      <Popover
        variant="help"
        isOpen={open}
        onOpenChange={setOpen}
        triggerRef={trigger}
        aria-label="Rich help"
      >
        <p>Rich help supports paragraphs.</p>
        <strong>Keep this content readable.</strong>
      </Popover>
    </>
  )
}

it('hands visible help from a forced tooltip to click-open rich help without reclaiming it', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const tree = (extra: ReactNode = null) => (
    <PicodashThemeProvider theme="dark">
      <Tooltip isOpen>
        <TooltipTrigger>
          <Button>Recording</Button>
        </TooltipTrigger>
        <TooltipContent>Live recording help</TooltipContent>
      </Tooltip>
      <RichHelp />
      {extra}
    </PicodashThemeProvider>
  )
  try {
    await act(async () => root.render(tree()))
    expect(document.querySelector('[role="tooltip"]')?.textContent).toContain('Live recording')
    const trigger = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === 'Open rich help',
    )!
    await act(async () => trigger.click())
    expect(document.querySelector('[role="tooltip"]')).toBeNull()
    const popover = document.querySelector('[data-picodash-popover-variant="help"]')!
    expect(popover.getAttribute('variant')).toBeNull()
    expect(popover.getAttribute('data-picodash-theme')).toBe('dark')
    expect(popover.textContent).toContain('Rich help supports paragraphs')
    await act(async () => root.render(tree(<span>Unrelated render</span>)))
    expect(document.querySelector('[role="tooltip"]')).toBeNull()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})
