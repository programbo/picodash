import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vite-plus/test'
import { FeaturePanel } from '../src/index.ts'

test('renders feature panel content', () => {
  const html = renderToStaticMarkup(
    <FeaturePanel
      title="Release Panel"
      metric={{ label: 'Readiness', value: '92%' }}
      items={[{ label: 'Build health', value: 'Passing', status: 'success' }]}
    />,
  )

  expect(html).toContain('Release Panel')
  expect(html).toContain('Readiness')
  expect(html).toContain('Build health')
})
