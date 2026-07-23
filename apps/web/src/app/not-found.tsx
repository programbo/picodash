import Link from 'next/link'

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="dark bg-background text-foreground grid min-h-svh place-items-center overflow-x-hidden px-6 py-16"
      data-product-route="not-found"
    >
      <section aria-labelledby="not-found-title" className="grid max-w-lg gap-5 text-center">
        <p className="text-muted-foreground text-sm font-medium tracking-[0.16em] uppercase">404</p>
        <div className="grid gap-2">
          <h1 id="not-found-title" className="text-3xl font-medium">
            Page not found
          </h1>
          <p className="text-muted-foreground">
            That Picodash page does not exist. Return to the Picodash home page.
          </p>
        </div>
        <nav aria-label="Page not found">
          <Link
            className="bg-primary text-primary-foreground inline-flex h-9 items-center px-4 text-sm font-medium"
            href="/"
          >
            Open home
          </Link>
        </nav>
      </section>
    </main>
  )
}
