import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import '@picodash/panel/style.css'
import '../../../web/src/style.css'

export const metadata: Metadata = {
  title: {
    default: 'Picodash Lab',
    template: '%s · Picodash Lab',
  },
  description: 'Local debugging playgrounds for Picodash.',
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  )
}
