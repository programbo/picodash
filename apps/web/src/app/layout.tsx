import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import '@picodash/theme/style.css'
import '@picodash/dashpanel/style.css'
import '@picodash/dashlist/style.css'
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
    <html
      lang="en"
      className="dark scroll-smooth motion-reduce:scroll-auto"
      data-scroll-behavior="smooth"
    >
      <body>{children}</body>
    </html>
  )
}
