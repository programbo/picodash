import type { Metadata } from 'next'

import { ExamplesPage } from '@/components/examples/examples-page'

export const metadata: Metadata = {
  title: 'Examples',
  description:
    'Compiled Picodash recipes for performance monitoring, media transport, deployment recovery, and application-specific controls.',
}

export default function ExamplesRoute() {
  return <ExamplesPage />
}
