'use client'

import { useEffect } from 'react'
import type { CoreTransactionResult, PicodashFieldDefinitions, RootNexus } from '@picodash/nexus'
import type {
  PicodashDevBridgeDisclosure,
  PicodashDevBridgePermissions,
} from '@picodash/dev-bridge'

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

const primaryDisclosure: PicodashDevBridgeDisclosure = {
  valueFields: ['specimenMetric', 'specimenUnit'],
  scopeIds: [
    'contract-lab-specimen-panel',
    'contract-lab-standalone-panel',
    'contract-lab-standalone-list',
  ],
  diagnostics: true,
}
const primaryPermissions: PicodashDevBridgePermissions = { writableFields: ['specimenMetric'] }

export interface ContractLabDevBridgeConnectorProps<
  Fields extends PicodashFieldDefinitions = PicodashFieldDefinitions,
> {
  readonly nexus: RootNexus<Fields, CoreTransactionResult>
  readonly registrationId?: string
  readonly label?: string
  readonly disclosure?: PicodashDevBridgeDisclosure
  readonly permissions?: PicodashDevBridgePermissions
}

export function ContractLabDevBridgeConnector<Fields extends PicodashFieldDefinitions>({
  nexus,
  registrationId = 'contract-lab-specimen',
  label = 'Contract Lab primary specimen',
  disclosure = primaryDisclosure,
  permissions = primaryPermissions,
}: ContractLabDevBridgeConnectorProps<Fields>) {
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
          nexus,
          credential,
          registrationId,
          label,
          disclosure,
          permissions,
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
  }, [disclosure, label, nexus, permissions, registrationId])
  return null
}
