import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

test('reorders the long control desk with glass drag surfaces and fixed pin lanes', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1200, height: 1100 })
  await page.goto('/lab')
  await page.getByRole('button', { name: 'Reset lab', exact: true }).click()
  await page.getByRole('button', { name: /^Value binding:/ }).click()
  const desk = page.getByRole('list', { name: 'Workspace control desk', exact: true })
  await desk.scrollIntoViewIfNeeded()
  const lane = (name: string) => desk.locator(`:scope > [data-picodash-dashlist-band="${name}"]`)
  const ids = (name: string) =>
    lane(name)
      .locator(':scope > [role="listitem"]')
      .evaluateAll((nodes) =>
        nodes.map(
          (node) =>
            node.getAttribute('data-picodash-dashlet') ??
            node.getAttribute('data-picodash-dashgroup'),
        ),
      )
  const payload = () =>
    page.evaluate(() => localStorage.getItem('picodash-contract-lab-value-binding-v1'))
  const initial = await ids('automatic')
  await expect
    .poll(() => lane('automatic').evaluate((node) => node.scrollHeight > node.clientHeight))
    .toBe(true)
  const pinnedTop = (await lane('start').boundingBox())!.y
  const pinnedBottom = (await lane('end').boundingBox())!.y
  await lane('automatic').evaluate((node) => {
    node.scrollTop = 150
  })
  expect((await lane('start').boundingBox())!.y).toBe(pinnedTop)
  expect((await lane('end').boundingBox())!.y).toBe(pinnedBottom)
  await lane('automatic').evaluate((node) => {
    node.scrollTop = 0
  })
  const group = desk.locator('[data-picodash-dashgroup="workspace"]')
  const handle = desk.getByRole('button', { name: 'Reorder Workspace', exact: true })
  const groupIdentity = await group.elementHandle()
  const from = (await handle.boundingBox())!
  const before = await payload()
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 5, { steps: 5 })
  await expect(group).toHaveAttribute('data-picodash-reorder-active', '')
  const paint = await group.evaluate((node) => {
    const style = getComputedStyle(node)
    return {
      opacity: Number(style.opacity),
      blur: style.backdropFilter,
      shadow: style.boxShadow,
      transform: style.transform,
    }
  })
  expect(paint.opacity).toBe(1)
  expect(paint.blur).toContain('blur(')
  expect(paint.shadow).not.toBe('none')
  expect(paint.transform).not.toBe('none')
  expect(await payload()).toBe(before)
  const directory = resolve(process.cwd(), '../../output/playwright/m6')
  await mkdir(directory, { recursive: true })
  const activity = desk.locator('[data-picodash-dashlet="activity"]')
  const destination = (await activity.boundingBox())!
  const sourceBox = (await group.boundingBox())!
  // Stop just short of covering half the sibling, then cross the exact midpoint.
  const threshold =
    from.y +
    from.height / 2 +
    destination.y +
    destination.height / 2 -
    (sourceBox.y + sourceBox.height - 5)
  await page.mouse.move(from.x + from.width / 2, threshold - 1)
  expect(await ids('automatic')).toEqual(initial)
  const path = resolve(directory, 'group-drag.png')
  const blurred = await desk.screenshot({ path })
  await group.evaluate((node) => {
    node.style.backdropFilter = 'none'
  })
  const sharpPath = resolve(directory, 'group-drag-without-blur.png')
  const sharp = await desk.screenshot({ path: sharpPath })
  await group.evaluate((node) => {
    node.style.removeProperty('backdrop-filter')
  })
  expect(blurred.equals(sharp), 'backdrop blur must change the rendered overlap').toBe(false)
  await testInfo.attach('group-drag', { path, contentType: 'image/png' })
  await testInfo.attach('group-drag-without-blur', { path: sharpPath, contentType: 'image/png' })
  await activity.evaluate((node) => {
    const frames: number[] = []
    const sample = () => {
      frames.push(node.getBoundingClientRect().top)
      node.setAttribute('data-test-positions', JSON.stringify(frames))
      if (frames.length < 30) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  await page.mouse.move(from.x + from.width / 2, threshold)
  await expect.poll(() => ids('automatic')).not.toEqual(initial)
  expect(await group.evaluate((node, original) => node === original, groupIdentity)).toBe(true)
  await expect
    .poll(async () => {
      const positions: number[] = JSON.parse(
        (await activity.getAttribute('data-test-positions')) ?? '[]',
      )
      return new Set(positions.map((value) => Math.round(value * 10))).size
    })
    .toBeGreaterThan(3)
  expect(await group.evaluate((node, original) => node === original, groupIdentity)).toBe(true)
  const autoBox = (await lane('automatic').boundingBox())!
  await page.mouse.move(from.x + from.width / 2, autoBox.y + autoBox.height - 8)
  await expect.poll(() => lane('automatic').evaluate((node) => node.scrollTop)).toBeGreaterThan(40)
  expect(await payload()).toBe(before)
  expect((await lane('start').boundingBox())!.y).toBe(pinnedTop)
  expect((await lane('end').boundingBox())!.y).toBe(pinnedBottom)
  await page.mouse.up()
  await expect(group).not.toHaveAttribute('data-picodash-reorder-active')
  const committed = await ids('automatic')
  await page.reload()
  await expect.poll(() => ids('automatic')).toEqual(committed)
  await desk.scrollIntoViewIfNeeded()
  // Pinned groups and rows can move within their band, never into the automatic lane.
  for (const [band, label] of [
    ['start', 'Pinned · Workspace'],
    ['end', 'Pinned · Cadence'],
  ] as const) {
    const grip = desk.getByRole('button', { name: `Reorder ${label}`, exact: true })
    const prior = await ids(band)
    await grip.press('Enter')
    await grip.press('End')
    await grip.press('ArrowDown')
    await grip.press('Enter')
    expect(await ids(band)).toEqual([...prior].reverse())
    expect(await ids('automatic')).toEqual(committed)
  }
  await page
    .getByRole('region', { name: 'Standalone value binding' })
    .getByRole('button', { name: 'Dark', exact: true })
    .click()
  const nameInput = desk.getByRole('textbox', { name: 'Workspace name', exact: true })
  await nameInput.fill('')
  const inputIdentity = await nameInput.elementHandle()
  const childGrip = desk.getByRole('button', { name: 'Reorder Workspace name', exact: true })
  await childGrip.scrollIntoViewIfNeeded()
  const childBox = (await childGrip.boundingBox())!
  const childPayload = await payload()
  await page.mouse.move(childBox.x + childBox.width / 2, childBox.y + childBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(childBox.x + childBox.width / 2, childBox.y + 65, { steps: 6 })
  const childRow = desk.locator('[data-picodash-dashlet="workspace-name"]')
  await expect(childRow).toHaveAttribute('data-picodash-reorder-active', '')
  expect(await childRow.evaluate((node) => getComputedStyle(node).backdropFilter)).toContain(
    'blur(',
  )
  expect(await nameInput.evaluate((node, original) => node === original, inputIdentity)).toBe(true)
  const childPath = resolve(directory, 'dashlet-drag-dark.png')
  await desk.screenshot({ path: childPath })
  await testInfo.attach('dashlet-drag-dark', { path: childPath, contentType: 'image/png' })
  await childGrip.dispatchEvent('pointercancel', { pointerId: 1 })
  await page.mouse.up()
  expect(await payload()).toBe(childPayload)
  await expect(nameInput).toHaveValue('')
  await expect(nameInput).toHaveAttribute('aria-invalid', 'true')
  // Reduced motion keeps pickup and commit semantics while removing displacement animation.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const name = desk.getByRole('button', { name: 'Reorder Workspace name', exact: true })
  await name.scrollIntoViewIfNeeded()
  await name.press('Enter')
  await name.press('ArrowDown')
  await name.press('Escape')
  await expect(desk.locator('[data-picodash-reorder-active]')).toHaveCount(0)
  expect(errors).toEqual([])
})
