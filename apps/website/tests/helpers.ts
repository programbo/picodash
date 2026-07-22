import { expect, type Locator } from '@playwright/test'

export async function requiredBox(locator: Locator) {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  return box!
}
