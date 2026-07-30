import { useState } from 'react'

type ViewerRole = 'user' | 'operator' | 'developer'

type Sample = {
  id: number
  requests: number
  latency: number
  errors: number
  progress: number
  status: 'healthy' | 'degraded' | 'disconnected' | 'recovering'
}

const samples: readonly Sample[] = [
  { id: 0, requests: 812, latency: 74, errors: 0.2, progress: 20, status: 'healthy' },
  { id: 1, requests: 930, latency: 92, errors: 0.4, progress: 45, status: 'healthy' },
  { id: 2, requests: 740, latency: 184, errors: 2.8, progress: 62, status: 'degraded' },
  { id: 3, requests: 0, latency: 0, errors: 0, progress: 62, status: 'disconnected' },
  { id: 4, requests: 510, latency: 148, errors: 1.1, progress: 80, status: 'recovering' },
  { id: 5, requests: 1024, latency: 68, errors: 0.1, progress: 100, status: 'healthy' },
]

export function App() {
  const [role, setRole] = useState<ViewerRole>('operator')
  const [sampleIndex, setSampleIndex] = useState(0)
  const sample = samples[sampleIndex % samples.length]!

  function advanceSample() {
    setSampleIndex((current) => current + 1)
  }

  return (
    <main className="monitor-shell">
      <header>
        <div>
          <p className="eyebrow">North region</p>
          <h1>Relay service</h1>
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

      <section className="summary" aria-label="Host service summary">
        <article>
          <span>Requests/min</span>
          <strong data-testid="host-requests">{sample.requests}</strong>
        </article>
        <article>
          <span>p95 latency</span>
          <strong data-testid="host-latency">{sample.latency} ms</strong>
        </article>
        <article>
          <span>Status</span>
          <strong data-testid="host-status">{sample.status}</strong>
        </article>
        <article>
          <span>Deployment</span>
          <strong data-testid="host-progress">{sample.progress}%</strong>
        </article>
      </section>

      <button type="button" onClick={advanceSample}>
        Advance sample
      </button>
    </main>
  )
}
