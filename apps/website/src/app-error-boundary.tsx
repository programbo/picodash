import { Component, type ReactNode } from 'react'

type AppErrorBoundaryProps = {
  children: ReactNode
}

type AppErrorBoundaryState = {
  failed: boolean
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <main
        id="main-content"
        className="dark bg-background text-foreground grid min-h-svh place-items-center px-6 py-16"
      >
        <section className="border-border bg-card grid max-w-lg gap-4 border p-6 text-center">
          <div className="grid gap-2">
            <h1 className="text-2xl font-medium">Picodash could not render this page</h1>
            <p className="text-muted-foreground text-sm leading-6">
              Reload the page to reset the current website session.
            </p>
          </div>
          <button
            className="bg-primary text-primary-foreground mx-auto inline-flex h-9 items-center px-4 text-sm font-medium"
            type="button"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </section>
      </main>
    )
  }
}
