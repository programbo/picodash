export type FeatureValues = {
  apiEndpoint: string
  logLevel: 'error' | 'warn' | 'info' | 'debug'
  newSearch: boolean
  rolloutPercent: number
}

type FeatureSnapshot = FeatureValues & {
  cacheEntries: number
  lastAction: 'idle' | 'cache-cleared' | 'failure-simulated'
}

type Listener = () => void

let snapshot: FeatureSnapshot = {
  apiEndpoint: 'https://api.example.test/v2',
  logLevel: 'info',
  newSearch: false,
  rolloutPercent: 10,
  cacheEntries: 24,
  lastAction: 'idle',
}

const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener()
}

export const featureStore = {
  getSnapshot(this: void): FeatureSnapshot {
    return snapshot
  },

  subscribe(this: void, listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  updateValues(patch: Partial<FeatureValues>): void {
    snapshot = { ...snapshot, ...patch }
    emit()
  },

  replaceValues(values: FeatureValues): void {
    snapshot = { ...snapshot, ...values }
    emit()
  },

  clearCache(): void {
    snapshot = { ...snapshot, cacheEntries: 0, lastAction: 'cache-cleared' }
    emit()
  },

  simulateFailure(): void {
    snapshot = { ...snapshot, lastAction: 'failure-simulated' }
    emit()
  },
}
