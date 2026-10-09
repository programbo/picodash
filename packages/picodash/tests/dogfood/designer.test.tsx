// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { fireEvent, getByLabelText, getByRole } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { createWebStoragePersistenceDriver } from '@picodash/nexus/web-storage'
import { DesignerRecipe } from './Designer.js'
import {
  createDesigner,
  createPersistentDesigner,
  defaultDesign,
  selectDesign,
  setPriority,
  scopeId,
  type Solver,
} from './designer-model.js'

// Deterministic fixture, not gear geometry or an engineering solver.
const solve: Solver = (design, priority) =>
  design.diameter < 40
    ? null
    : {
        profilePath: 'M -10 -10 L 10 -10 L 10 10 L -10 10 Z',
        halfExtent: design.diameter / 2,
        summary: `${priority} first; ${design.diameter} mm`,
      }
function mounted() {
  const nexus = createDesigner(solve)
  const element = document.createElement('div')
  document.body.append(element)
  const root = createRoot(element)
  act(() => root.render(createElement(DesignerRecipe, { nexus, solve })))
  return {
    nexus,
    element,
    close() {
      act(() => root.unmount())
      element.remove()
      nexus.destroy()
    },
  }
}

describe('external designer consumer recipes', () => {
  it('retains an invalid member draft and accepted result across programmatic writes', () => {
    const app = mounted()
    try {
      const moduleInput = getByLabelText(app.element, 'module')
      const ratioInput = getByLabelText(app.element, 'ratio')
      act(() => {
        fireEvent.change(moduleInput, { target: { value: 'invalid' } })
      })
      expect(moduleInput.getAttribute('aria-invalid')).toBe('true')
      expect(ratioInput.hasAttribute('aria-invalid')).toBe(false)
      expect(app.nexus.getState().values.design).toEqual(defaultDesign)
      expect(getByRole(app.element, 'img').getAttribute('aria-label')).toBe('ratio first; 90 mm')
      const failed = app.nexus.setValue(app.nexus.fields.design, { ...defaultDesign, diameter: 35 })
      expect(failed.ok).toBe(false)
      expect(app.nexus.getState().values.design).toEqual(defaultDesign)
      act(() => {
        app.nexus.setValue(app.nexus.fields.design, { ...defaultDesign, diameter: 100 })
      })
      const draft = app.nexus
        .scope(scopeId)
        .getState()
        .interaction.bindings.get('request')
        ?.get('design')
      expect(draft?.conflict?.kind).toBe('stale-draft')
      expect(draft?.draft).toMatchObject({ module: 'invalid' })
      expect(getByRole(app.element, 'img').getAttribute('aria-label')).toBe('ratio first; 100 mm')
      act(() => {
        fireEvent.click(getByRole(app.element, 'button', { name: 'Discard draft' }))
      })
      expect(app.nexus.scope(scopeId).getState().interaction.bindings.size).toBe(0)
    } finally {
      app.close()
    }
  })

  it('matches UI and headless priority; preview, cancel, and no-op write nothing', () => {
    const app = mounted()
    let notifications = 0
    const unsubscribe = app.nexus.subscribe(() => {
      notifications += 1
    })
    try {
      const handle = () => getByRole(app.element, 'button', { name: 'Reorder Reduction' })
      const key = (key: string) =>
        act(() => {
          fireEvent.keyDown(handle(), { key })
        })
      key('Enter')
      key('ArrowDown')
      expect(selectDesign(app.nexus.getState(), solve).priority).toBe('ratio')
      key('Escape')
      expect(notifications).toBe(0)
      key('Enter')
      key('Enter')
      expect(notifications).toBe(0)
      key('Enter')
      key('ArrowDown')
      key('Enter')
      expect(selectDesign(app.nexus.getState(), solve).priority).toBe('module')
      expect(getByLabelText(app.element, 'Committed priority').textContent).toBe('module')
      expect(notifications).toBe(1)
      expect(setPriority(app.nexus, 'module')).toBe(null)
      expect(notifications).toBe(1)
      act(() => {
        setPriority(app.nexus, 'ratio')
      })
      expect(getByLabelText(app.element, 'Committed priority').textContent).toBe('ratio')
    } finally {
      unsubscribe()
      app.close()
    }
  })

  it('exports and atomically restores values and priority without UI registrations', () => {
    const source = createDesigner(solve)
    const target = createDesigner(solve)
    try {
      source.setValue(source.fields.design, { ...defaultDesign, diameter: 120 })
      setPriority(source, 'module')
      const exported = source.documents.executeExport(source.documents.createExportPlan())
      if (!exported.ok) throw new Error('Export failed')
      const json: unknown = JSON.parse(JSON.stringify(exported.document))
      const analysis = target.documents.analyzeImport(json, { createMissingScopes: true })
      if (!analysis.ok) throw new Error('Import analysis failed')
      let notifications = 0
      const unsubscribe = target.subscribe(() => {
        notifications += 1
      })
      expect(target.documents.executeImport(analysis.plan).ok).toBe(true)
      expect(notifications).toBe(1)
      unsubscribe()
      expect(selectDesign(target.getState(), solve)).toEqual(selectDesign(source.getState(), solve))
      expect(Object.keys(target.getState().values)).toEqual(['design'])
    } finally {
      source.destroy()
      target.destroy()
    }
  })

  it('reloads values and priority and reports failed durability', () => {
    const saved = new Map<string, string>()
    let fail = false
    const driver = createWebStoragePersistenceDriver({
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => {
        if (fail) throw new Error('storage full')
        saved.set(key, value)
      },
      removeItem: (key) => {
        saved.delete(key)
      },
    })
    const first = createPersistentDesigner(solve, driver)
    first.setValue(first.fields.design, { ...defaultDesign, diameter: 120 })
    setPriority(first, 'module')
    first.destroy()
    const restored = createPersistentDesigner(solve, driver)
    try {
      expect(selectDesign(restored.getState(), solve).priority).toBe('module')
      expect(restored.getState().values.design.diameter).toBe(120)
      fail = true
      expect(
        restored.setValue(restored.fields.design, { ...defaultDesign, diameter: 130 }),
      ).toMatchObject({ ok: true, persistence: 'pending' })
      expect(restored.persistence.getState().status).toBe('error')
      expect(restored.getState().values.design.diameter).toBe(130)
      fail = false
      expect(restored.persistence.flush()).toBe('saved')
    } finally {
      restored.destroy()
    }
  })
})
