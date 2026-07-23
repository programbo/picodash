import { expect, test } from '@playwright/test'
import {
  advanceSparklineSamplingClock,
  decayPointerVelocity,
} from '../src/custom-items/pointer-velocity-sampling'

test('drops delayed pointer velocity intervals instead of backfilling history', () => {
  const sampleInterval = 1000 / 60
  const clock = advanceSparklineSamplingClock(4, 4, 100, sampleInterval)

  expect(clock.shouldCommit).toBe(true)
  expect(clock.accumulatedTime).toBeCloseTo(104 % sampleInterval)
  expect(clock.accumulatedTime).toBeLessThan(sampleInterval)
  expect(clock.decayElapsed).toBe(104)
  expect(clock.elapsedSinceCommit).toBe(0)

  const nextFrame = advanceSparklineSamplingClock(
    clock.accumulatedTime,
    clock.elapsedSinceCommit,
    0,
    sampleInterval,
  )
  expect(nextFrame.shouldCommit).toBe(false)
  expect(decayPointerVelocity(1000, 84)).toBeCloseTo(1000 * 0.72 ** 2)
})
