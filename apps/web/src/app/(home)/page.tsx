import { AlphaProducts } from '../../components/alpha-products'

const heroTitle = 'Build configurable control panels with typed React components'

export default function HomePage() {
  return (
    <main id="main-content" className="site-shell">
      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">React components</p>
        <h1 id="hero-title">{heroTitle}</h1>
        <p className="hero-intro">
          Picodash provides a typed Store plus standalone DashPanel and DashList packages for React
          applications.
        </p>
        <p className="hero-expectation">
          The current alpha supports provider-hosted Panel shells and Store-scoped List composition.
          Placement, field bindings, ready-made Dashlets, and integrated Picodash workflows are
          still under development.
        </p>
        <nav className="hero-actions" aria-label="Homepage actions">
          <a className="action-link action-link-primary" href="#current-alphas">
            View current alphas
          </a>
          <a
            className="action-link action-link-secondary"
            href="https://github.com/programbo/picodash/tree/main/docs/reference"
          >
            Read the contracts
          </a>
        </nav>
      </section>

      <section id="current-alphas" className="alpha-section" aria-labelledby="alpha-title">
        <div className="section-heading">
          <p className="eyebrow">Current alpha packages</p>
          <h2 id="alpha-title">Two standalone React products</h2>
        </div>
        <div className="alpha-copy-grid">
          <p>
            DashPanel renders arbitrary React content in a Store-backed Panel with Provider-owned
            scope and theme context.
          </p>
          <p>
            DashList composes named Dashlets and one level of groups against a root or scoped Store.
          </p>
        </div>
        <AlphaProducts />
      </section>
    </main>
  )
}
