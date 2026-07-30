import {
  normalizePicodashDiagnostic,
  type PicodashDiagnostic,
  type PicodashDiagnosticInput,
  type PicodashErrorCode,
} from './errors.js'

export type PicodashDiagnosticListener = (snapshot: readonly PicodashDiagnostic[]) => void

export interface PicodashDiagnosticChannel {
  clear: (code?: PicodashErrorCode) => void
  getSnapshot: () => readonly PicodashDiagnostic[]
  publish: (diagnostic: PicodashDiagnostic | PicodashDiagnosticInput) => PicodashDiagnostic
  subscribe: (listener: PicodashDiagnosticListener) => () => void
}

export function createPicodashDiagnosticChannel(): PicodashDiagnosticChannel {
  const diagnostics = new Map<string, PicodashDiagnostic>()
  const listeners = new Set<PicodashDiagnosticListener>()
  let snapshot: readonly PicodashDiagnostic[] = Object.freeze([])

  const notify = () => {
    snapshot = Object.freeze([...diagnostics.values()])
    for (const listener of listeners) listener(snapshot)
  }

  const channel: PicodashDiagnosticChannel = {
    clear(code) {
      if (code === undefined) {
        if (diagnostics.size === 0) return
        diagnostics.clear()
        notify()
        return
      }

      let changed = false
      for (const [fingerprint, diagnostic] of diagnostics) {
        if (diagnostic.code !== code) continue
        diagnostics.delete(fingerprint)
        changed = true
      }
      if (changed) notify()
    },
    getSnapshot() {
      return snapshot
    },
    publish(input) {
      const diagnostic = normalizePicodashDiagnostic(input)
      if (!diagnostics.has(diagnostic.fingerprint)) {
        diagnostics.set(diagnostic.fingerprint, diagnostic)
        notify()
      }
      return diagnostics.get(diagnostic.fingerprint) ?? diagnostic
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }

  return Object.freeze(channel)
}
