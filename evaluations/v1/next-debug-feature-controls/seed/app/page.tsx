'use client'

import { useSyncExternalStore, useState } from 'react'
import { featureStore } from './feature-store'

type ViewerRole = 'user' | 'operator' | 'developer'

export default function FeatureConsole() {
  const [role, setRole] = useState<ViewerRole>('developer')
  const snapshot = useSyncExternalStore(
    featureStore.subscribe,
    featureStore.getSnapshot,
    featureStore.getSnapshot,
  )

  return (
    <main className="console-shell">
      <header>
        <div>
          <p>Environment · staging</p>
          <h1>Search workspace</h1>
        </div>
        <label>
          Viewer role
          <select
            data-testid="viewer-role"
            value={role}
            onChange={(event) => setRole(event.target.value as ViewerRole)}
          >
            <option value="user">End user</option>
            <option value="operator">Operator</option>
            <option value="developer">Developer</option>
          </select>
        </label>
      </header>

      <section className="feature-card" aria-label="Host feature state">
        <div>
          <span>New search</span>
          <strong data-testid="host-new-search">
            {snapshot.newSearch ? 'Enabled' : 'Disabled'}
          </strong>
        </div>
        <div>
          <span>Rollout</span>
          <strong data-testid="host-rollout">{snapshot.rolloutPercent}%</strong>
        </div>
        <div>
          <span>Log level</span>
          <strong data-testid="host-log-level">{snapshot.logLevel}</strong>
        </div>
        <div>
          <span>Cache entries</span>
          <strong data-testid="host-cache-entries">{snapshot.cacheEntries}</strong>
        </div>
        <div>
          <span>Last action</span>
          <strong data-testid="host-last-action">{snapshot.lastAction}</strong>
        </div>
      </section>

      <div className="host-actions">
        <button
          type="button"
          onClick={() => featureStore.updateValues({ newSearch: !snapshot.newSearch })}
        >
          Toggle feature from host
        </button>
        <button type="button" onClick={() => featureStore.updateValues({ rolloutPercent: 65 })}>
          Set host rollout to 65%
        </button>
      </div>
    </main>
  )
}
