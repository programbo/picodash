import { expect, test } from 'vite-plus/test'
import { buttonVariants } from '../src/components/ui/button.tsx'
import { toggleVariants } from '../src/components/ui/toggle.tsx'

test('shows the same focus ring on React Aria and native buttons', () => {
  const classNames = buttonVariants().split(/\s+/)

  expect(classNames).toEqual(
    expect.arrayContaining([
      'focus-visible:ring-2',
      'focus-visible:ring-tweaker-focus',
      'focus-visible:ring-offset-1',
      'focus-visible:ring-offset-tweaker-canvas',
      'data-focus-visible:ring-2',
      'data-focus-visible:ring-tweaker-focus',
      'data-focus-visible:ring-offset-1',
      'data-focus-visible:ring-offset-tweaker-canvas',
    ]),
  )
})

test('lets the selected toggle state own its background across stylesheet boundaries', () => {
  const classNames = toggleVariants().split(/\s+/)

  expect(classNames).toContain('data-selected:bg-tweaker-accent')
  expect(classNames).not.toContain('bg-transparent')
})
