'use client'

import { useEffect } from 'react'
import type { CoreTransactionResult, PicodashFieldDefinitions, RootStore } from '@picodash/store'

const credentialUrl = process.env.NEXT_PUBLIC_PICODASH_DEV_BRIDGE_CREDENTIAL_URL

function validUrl(value: string | undefined) {
  if (!value) return false
  try {
    const url = new URL(value)
    return (
      url.protocol === 'http:' &&
      url.hostname === '127.0.0.1' &&
      url.port !== '' &&
      url.pathname === '/v1/browser-credential' &&
      !url.search &&
      !url.hash
    )
  } catch {
    return false
  }
}

export function ContractLabDevBridgeConnector({
  store,
}: {
  readonly store: RootStore<PicodashFieldDefinitions, CoreTransactionResult>
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || !validUrl(credentialUrl)) return
    const abort = new AbortController()
    let connection: { close(): Promise<void> } | undefined
    let active = true
    void (async () => {
      try {
        const response = await fetch(credentialUrl!, {
          method: 'POST',
          credentials: 'omit',
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
          signal: abort.signal,
        })
        if (!response.ok) throw new Error('credential broker rejected request')
        const credential = await response.json()
        if (!active) return
        const bridge = await import('@picodash/dev-bridge/browser')
        if (!active) return
        const connected = await bridge.connectPicodashDevBridge({
          store,
          credential,
          registrationId: 'contract-lab-specimen',
          label: 'Contract Lab primary specimen',
          disclosure: {
            valueFields: ['specimenMetric'],
            scopeIds: ['contract-lab-specimen-panel'],
            diagnostics: true,
          },
          permissions: { writableFields: ['specimenMetric'] },
        })
        if (!active) await connected.close()
        else connection = connected
      } catch (error) {
        if (active && !(error instanceof DOMException && error.name === 'AbortError'))
          console.warn('[Picodash Dev Bridge] unavailable; credential redacted.')
      }
    })()
    return () => {
      active = false
      abort.abort()
      void connection?.close()
    }
  }, [store])
  return null
}
