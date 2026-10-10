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
  await page.getByRole('button', { name: 'Contract tools', exact: true }).click()
  await page.getByRole('button', { name: 'Reset lab', exact: true }).click()
  await page.getByRole('button', { name: /^Value binding:/ }).click()
  const desk = page.getByRole('list', { name: 'Workspace control desk', exact: true })
  await desk.scrollIntoViewIfNeeded()
  const lane = (name: string) => desk.locator(`:scope > [data-picodash-dashstack-band="${name}"]`)
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
    ['start', 'start-workspace pinned controls'],
    ['end', 'end-cadence pinned controls'],
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
  // Local pins fence real pointer movement inside a draggable organizational subgroup.
  const local = desk.getByRole('group', { name: 'Monitoring order', exact: true })
  await expect(
    desk.getByRole('button', { name: 'Reorder Monitoring order', exact: true }),
  ).toBeVisible()
  const subgroupTitle = local.getByText('Monitoring order', { exact: true })
  const subgroupRowLabel = local.getByText('Source workspace', { exact: true })
  const alignedSubgroupTitle = async () =>
    Math.abs((await subgroupTitle.boundingBox())!.x - (await subgroupRowLabel.boundingBox())!.x)
  expect(await alignedSubgroupTitle()).toBeLessThanOrEqual(2)
  const localIds = () =>
    local
      .locator('[data-picodash-dashlet]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-picodash-dashlet')))
  const polling = local.getByRole('button', { name: 'Reorder Polling cadence', exact: true })
  await polling.scrollIntoViewIfNeeded()
  const localFrom = (await polling.boundingBox())!
  const localEnd = (await local.getByText('Connection', { exact: true }).boundingBox())!
  await page.mouse.move(localFrom.x + localFrom.width / 2, localFrom.y + localFrom.height / 2)
  await page.mouse.down()
  await page.mouse.move(localFrom.x + localFrom.width / 2, localEnd.y + localEnd.height, {
    steps: 8,
  })
  await page.mouse.up()
  await expect
    .poll(localIds)
    .toEqual(['monitoring-name', 'monitoring-summary', 'monitoring-interval', 'monitoring-state'])

  // Changing scroll policy preserves the same controls and committed orders.
  const stickyControls = page.getByRole('group', { name: 'Sticky lanes', exact: true })
  for (const mode of ['start', 'end', 'none', 'both'] as const) {
    await stickyControls.getByRole('button', { name: mode, exact: true }).click()
    await desk.scrollIntoViewIfNeeded()
    const scrollport = mode === 'both' ? lane('automatic') : desk
    await scrollport.evaluate((node) => {
      node.scrollTop = 0
    })
    const startBoxBefore = (await lane('start').boundingBox())!
    const middleBoxBefore = (await lane('automatic').boundingBox())!
    expect(middleBoxBefore.y).toBeGreaterThanOrEqual(startBoxBefore.y + startBoxBefore.height - 1)
    const top = (await lane('start').boundingBox())!.y
    const bottom = (await lane('end').boundingBox())!.y
    await scrollport.evaluate((node) => {
      node.scrollTop = 100
    })
    await expect.poll(() => scrollport.evaluate((node) => node.scrollTop)).toBe(100)
    const topAfter = (await lane('start').boundingBox())!.y
    const bottomAfter = (await lane('end').boundingBox())!.y
    await desk.screenshot({ path: resolve(directory, `sticky-lanes-${mode}.png`) })
    if (mode === 'both' || mode === 'start') expect(topAfter).toBeCloseTo(top, 0)
    else expect(topAfter).toBeLessThan(top - 80)
    if (mode === 'both' || mode === 'end') expect(bottomAfter).toBeCloseTo(bottom, 0)
    else expect(bottomAfter).toBeLessThan(bottom - 80)
    if (mode === 'none') {
      await desk.evaluate((node) => {
        node.scrollTop = 0
      })
      const drag = desk.getByRole('button', { name: 'Reorder Activity', exact: true })
      await drag.scrollIntoViewIfNeeded()
      const dragBox = (await drag.boundingBox())!
      const viewport = (await desk.boundingBox())!
      const beforeDrag = await payload()
      const beforeScroll = await desk.evaluate((node) => node.scrollTop)
      await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(dragBox.x + dragBox.width / 2, viewport.y + viewport.height - 8, {
        steps: 8,
      })
      await expect
        .poll(() => desk.evaluate((node) => node.scrollTop))
        .toBeGreaterThan(beforeScroll + 30)
      await drag.dispatchEvent('pointercancel', { pointerId: 1 })
      await page.mouse.up()
      expect(await payload()).toBe(beforeDrag)
    }
    expect(await nameInput.evaluate((node, original) => node === original, inputIdentity)).toBe(
      true,
    )
    expect(await localIds()).toEqual([
      'monitoring-name',
      'monitoring-summary',
      'monitoring-interval',
      'monitoring-state',
    ])
  }
  // When pinned content cannot fit, the outer Stack exposes all lanes without overlap.
  const stack = desk.locator('..')
  for (const mode of ['both', 'start', 'end'] as const) {
    await stickyControls.getByRole('button', { name: mode, exact: true }).click()
    await stack.evaluate((node) => {
      node.style.height = '90px'
    })
    await expect(stack).toHaveAttribute('data-picodash-stack-overflow', '')
    const startBox = (await lane('start').boundingBox())!
    const endBox = (await lane('end').boundingBox())!
    expect(endBox.y).toBeGreaterThanOrEqual(startBox.y + startBox.height)
    await stack.evaluate((node) => {
      node.scrollTop = node.scrollHeight
    })
    await expect.poll(() => stack.evaluate((node) => node.scrollTop)).toBeGreaterThan(0)
    await stack.evaluate((node) => {
      node.style.removeProperty('height')
      node.scrollTop = 0
    })
    await expect(stack).not.toHaveAttribute('data-picodash-stack-overflow')
  }
  await local.scrollIntoViewIfNeeded()
  await local.screenshot({ path: resolve(directory, 'subgroup-header-desktop.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await local.scrollIntoViewIfNeeded()
  await expect.poll(alignedSubgroupTitle).toBeLessThanOrEqual(2)
  await local.screenshot({ path: resolve(directory, 'subgroup-header-mobile.png') })

  await page.getByRole('button', { name: 'Back to Dashlets', exact: true }).click()
  const countRange = page.locator('[data-picodash-dashlet="range-detents"]')
  const countTrack = countRange.locator('.picodash-dashstack-range-slider-track')
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await countRange.scrollIntoViewIfNeeded()
    await expect(countRange.getByRole('status', { name: 'Actual', exact: true })).toHaveText('4')
    const resultGeometry = () =>
      countTrack.evaluate((track) => {
        const box = track.getBoundingClientRect()
        const marker = track
          .querySelector('[data-picodash-achieved-marker]')!
          .getBoundingClientRect()
        const text = track
          .querySelector('[data-picodash-achieved-readout]')!
          .getBoundingClientRect()
        return {
          error: Math.abs(marker.x - (box.x + (box.width - Math.min(24, box.width * 0.3)) * 0.2)),
          below: text.top >= box.bottom,
          inside: text.left >= box.left && text.right <= box.right,
        }
      })
    await expect.poll(async () => (await resultGeometry()).error).toBeLessThan(1)
    expect(await resultGeometry()).toMatchObject({ below: true, inside: true })
    const countStart = countRange.getByRole('slider', { name: /^Start/ })
    await countStart.press('ArrowRight')
    await expect(countRange.getByRole('status', { name: 'Actual', exact: true })).toHaveText('4')
    await countStart.press('ArrowLeft')

    // Release clicks must preserve End focus; pointer feedback is not a keyboard ring.
    for (const row of [
      countRange,
      page.locator('[data-picodash-dashlet="RangeDashlet"]'),
      page.locator('[data-picodash-dashlet="SliderDashlet"]'),
      page.locator('[data-picodash-dashlet="endpoint-detents"]'),
    ]) {
      await row.scrollIntoViewIfNeeded()
      const end = row.getByRole('slider').last()
      const thumb = row
        .locator(
          '[data-picodash-dashstack-range-slider-thumb], [data-picodash-dashstack-slider-thumb]',
        )
        .last()
      const box = (await thumb.boundingBox())!
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await expect(end).toBeFocused()
      await expect(thumb).toHaveCSS('outline-style', 'none')
      await page.mouse.move(box.x + box.width / 2 - 5, box.y + box.height / 2)
      await page.mouse.up()
      await expect(end).toBeFocused()
      await expect(thumb).toHaveCSS('outline-style', 'none')
      await end.press('ArrowLeft')
      await expect(end).toBeFocused()
      await expect(thumb).toHaveCSS('outline-style', 'solid')
    }
    await countRange.scrollIntoViewIfNeeded()
    await countRange.screenshot({ path: resolve(directory, `range-actual-${width}.png`) })
  }
  expect(errors).toEqual([])
})

test('detaches one retained group surface and returns it through keyboard, drag and responsive fallback', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/lab')
  const group = page.locator('[data-picodash-dashgroup="target-feedback"]')
  const header = group.locator(':scope > [role="group"] > [data-slot="dash-header"]')
  const detach = page.getByRole('button', { name: 'Detach group Target feedback', exact: true })
  const panel = page.getByRole('complementary', { name: 'Target feedback', exact: true })
  const editor = page.getByRole('textbox', { name: 'Target Bore', exact: true })
  const original = await editor.elementHandle()
  await editor.fill('7.')
  await detach.focus()
  await page.keyboard.press('Enter')
  await expect(panel).toBeVisible()
  await expect
    .poll(() => panel.evaluate((node) => node.contains(document.activeElement)))
    .toBe(true)
  expect(await editor.evaluate((node, original) => node === original, original)).toBe(true)
  const value = await editor.inputValue()
  await page.getByRole('button', { name: 'Return Target feedback to stack', exact: true }).click()
  await expect(panel).toHaveCount(0)
  await expect(group.getByRole('button', { name: 'Collapse group Target feedback' })).toBeFocused()
  expect(await editor.inputValue()).toBe(value)
  expect(await editor.evaluate((node, original) => node === original, original)).toBe(true)
  const band = group.locator('..')
  const order = () =>
    band
      .locator(':scope > [role="listitem"]')
      .evaluateAll((nodes) =>
        nodes.map(
          (node) =>
            node.getAttribute('data-picodash-dashgroup') ??
            node.getAttribute('data-picodash-dashlet'),
        ),
      )
  const before = await order()
  const pull = async () => {
    await header.scrollIntoViewIfNeeded()
    const box = (await header.boundingBox())!
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 8, y + 16, { steps: 4 })
    await page.mouse.move(x + 64, y + 16, { steps: 4 })
    await expect(panel).toBeVisible()
    await expect(panel).toHaveAttribute('data-picodash-dragging', 'true')
    await page.mouse.move(x + 320, y - 80, { steps: 6 })
    return { x, y }
  }
  await pull()
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(panel).toHaveCount(0)
  expect(await order()).toEqual(before)
  expect(await editor.evaluate((node, original) => node === original, original)).toBe(true)
  await pull()
  await page.mouse.up()
  await expect(panel).not.toHaveAttribute('data-picodash-dragging')
  expect(await order()).toEqual(before)
  const settled = (await panel.boundingBox())!
  expect(settled.x).toBeGreaterThan((await group.boundingBox())!.x + 150)
  // Move a settled Panel over its own Stack. Only the empty home slot expands.
  const ph = panel.locator('[data-slot="dash-header"]').first()
  const pb = (await ph.boundingBox())!
  const home = (await header.boundingBox())!
  await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2)
  await page.mouse.down()
  await page.mouse.move(home.x + home.width / 2, home.y + home.height / 2, { steps: 8 })
  await expect(group).toHaveAttribute('data-picodash-return-home', '')
  await expect(page.locator('[data-picodash-group-home][data-return-preview]')).toBeVisible()
  expect(await page.getByRole('textbox', { name: 'Target Bore', exact: true }).count()).toBe(1)
  await page.mouse.up()
  await expect(panel).toHaveCount(0)
  // A remembered collapsed group opens in its Panel and returns collapsed.
  await group.getByRole('button', { name: 'Collapse group Target feedback' }).click()
  await detach.click()
  await expect(panel.getByRole('textbox', { name: 'Target Bore', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Return Target feedback to stack', exact: true }).click()
  await expect(group.getByRole('button', { name: 'Expand group Target feedback' })).toBeFocused()
  await expect(editor).toBeHidden()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await detach.click()
  await expect(panel).toBeVisible()
  await page.setViewportSize({ width: 600, height: 900 })
  await expect(panel).toHaveCount(0)
  await expect(detach).toBeDisabled()
  await page.setViewportSize({ width: 1280, height: 900 })
  await expect(detach).toBeEnabled()
  await expect(panel).toHaveCount(0)
  expect(errors).toEqual([])
})
