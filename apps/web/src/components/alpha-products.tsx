'use client'

import { useState } from 'react'
import { createPicodashStore } from '@picodash/store'
import { DashHeader } from '@picodash/ui'
import { DashPanel, DashPanelProvider } from '@picodash/dashpanel'
import { DashGroup, Dashlet, DashList } from '@picodash/dashlist'

export function AlphaProducts() {
  const [panelStore] = useState(() => createPicodashStore({ valueOwner: 'store', fields: {} }))
  const [listStore] = useState(() => createPicodashStore({ valueOwner: 'store', fields: {} }))

  return (
    <div className="alpha-product-grid">
      <article className="alpha-product-card" data-alpha-product="dashpanel">
        <div className="alpha-product-demo alpha-panel-demo">
          <DashPanelProvider store={panelStore} providerId="alpha-panel" theme="dark">
            <DashPanel id="alpha-panel" title="DashPanel">
              <DashHeader slots={{ title: <span>Panel content</span> }} />
              <p>Arbitrary React content renders inside this Panel.</p>
            </DashPanel>
          </DashPanelProvider>
        </div>
      </article>

      <article className="alpha-product-card" data-alpha-product="dashlist">
        <div className="alpha-product-demo alpha-list-demo">
          <DashList store={listStore} id="alpha-list" title="DashList" headingLevel={2}>
            <DashGroup id="alpha-group" label="First group">
              <Dashlet id="alpha-dashlet" label="Named Dashlet">
                <p>Dashlet content is composed directly in the List.</p>
              </Dashlet>
            </DashGroup>
          </DashList>
        </div>
      </article>
    </div>
  )
}
