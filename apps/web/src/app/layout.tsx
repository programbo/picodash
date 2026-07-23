import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import '@picodash/panel/style.css'
import '../style.css'

export const metadata: Metadata = {
  title: {
    default: 'Picodash',
    template: '%s · Picodash',
  },
  description: 'The composable React control panel for Picodash.',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  )
}
