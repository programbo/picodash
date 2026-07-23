const decayReferenceInterval = 42
const decayReferenceFactor = 0.72

export interface SparklineSamplingClock {
  accumulatedTime: number
  decayElapsed: number
  elapsedSinceCommit: number
  shouldCommit: boolean
}

export function advanceSparklineSamplingClock(
  accumulatedTime: number,
  elapsedSinceCommit: number,
  elapsedMilliseconds: number,
  sampleInterval: number,
): SparklineSamplingClock {
  const elapsed = Math.max(0, elapsedMilliseconds)
  const nextAccumulatedTime = accumulatedTime + elapsed
  const nextElapsedSinceCommit = elapsedSinceCommit + elapsed

  if (nextAccumulatedTime < sampleInterval) {
    return {
      accumulatedTime: nextAccumulatedTime,
      decayElapsed: 0,
      elapsedSinceCommit: nextElapsedSinceCommit,
      shouldCommit: false,
    }
  }

  return {
    accumulatedTime: nextAccumulatedTime % sampleInterval,
    decayElapsed: nextElapsedSinceCommit,
    elapsedSinceCommit: 0,
    shouldCommit: true,
  }
}

export function decayPointerVelocity(value: number, elapsedMilliseconds: number) {
  const decayed = value * decayReferenceFactor ** (elapsedMilliseconds / decayReferenceInterval)
  return Math.abs(decayed) < 1 ? 0 : decayed
}
