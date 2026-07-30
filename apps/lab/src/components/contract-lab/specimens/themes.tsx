'use client'

import { createPicodashStore, type PicodashStore } from '@picodash/store'
import { usePicodashStoreSelector } from '@picodash/store/react'
import { PicodashItem, PicodashPanel, PicodashSegmented } from '@picodash/panel'
import * as Dashlet from '@picodash/panel/dashlet'

type ThemeValues = {
  recipe: 'contrast' | 'dark' | 'light' | 'system'
}

export function createThemeStore() {
  return createPicodashStore<ThemeValues>({
    fields: {
      recipe: { defaultValue: 'dark' },
    },
    panelId: 'contract-themes-primary',
  })
}

export function ThemeSpecimen({ store }: { readonly store: PicodashStore<ThemeValues> }) {
  const theme = usePicodashStoreSelector(store, (state) => state.values.recipe)

  return (
    <PicodashPanel
      close
      collapsible
      data-contract-lab-primary-panel
      data-theme-probe={theme}
      defaultPlacement={{
        disposition: { kind: 'snapped', position: 'top-right' },
        mode: 'floating',
      }}
      store={store}
      theme={theme}
      title="Theme Contract"
      width={340}
    >
      <PicodashSegmented
        field={store.fields.recipe}
        label="Theme recipe"
        options={['dark', 'light', 'system', 'contrast']}
      />
      <PicodashItem id="semantic-token-probe" label="Semantic roles" contentLayout="full">
        <Dashlet.Frame>
          <Dashlet.Body className="grid grid-cols-2 gap-(--picodash-space-2)">
            {[
              ['Surface', 'var(--picodash-color-surface-raised)'],
              ['Accent', 'var(--picodash-color-accent)'],
              ['Success', 'var(--picodash-color-success)'],
              ['Danger', 'var(--picodash-color-danger)'],
            ].map(([label, color]) => (
              <Dashlet.Surface key={label} className="p-(--picodash-space-2)" variant="raised">
                <span
                  aria-hidden
                  className="rounded-picodash-control block h-8"
                  style={{ backgroundColor: color }}
                />
                <Dashlet.Caption className="mt-(--picodash-space-1)">{label}</Dashlet.Caption>
              </Dashlet.Surface>
            ))}
          </Dashlet.Body>
          <Dashlet.Footer>Panel override · portal carrier · reduced motion</Dashlet.Footer>
        </Dashlet.Frame>
      </PicodashItem>
    </PicodashPanel>
  )
}
