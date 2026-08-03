import Image from 'next/image'
import type { AuditReport as AuditReportData, AuditSeverity } from '@lab/lib/audits'

const severityStyles: Record<AuditSeverity, string> = {
  critical: 'border-red-500/40 bg-red-500/10 text-red-300',
  high: 'border-orange-500/40 bg-orange-500/10 text-orange-300',
  medium: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  note: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
}

export function AuditReport({ report }: Readonly<{ report: AuditReportData }>) {
  const issueCount = report.coverage.filter((item) => item.status === 'issue').length

  return (
    <main
      className="bg-background text-foreground min-h-svh"
      data-audit-id={report.id}
      data-product-route="audit"
    >
      <div className="border-border bg-card/80 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-[110rem] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="bg-foreground text-background grid size-7 place-items-center rounded font-mono text-xs font-bold">
              A
            </span>
            <div>
              <p className="font-mono text-xs font-semibold tracking-[0.12em] uppercase">
                Picodash audit
              </p>
              <p className="text-muted-foreground text-xs">{report.id}</p>
            </div>
          </div>
          <nav aria-label="Audit" className="flex items-center gap-2 text-sm">
            <a
              className="border-border bg-background hover:bg-accent rounded-md border px-3 py-2 font-medium"
              href="/lab"
            >
              Contract Lab
            </a>
            <a
              className="bg-foreground text-background rounded-md px-3 py-2 font-medium"
              href="http://localhost:6030/"
            >
              Open product
            </a>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-[110rem] px-4 py-8 sm:px-6 sm:py-12">
        <header className="grid gap-8 border-b pb-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div>
            <p className="text-muted-foreground font-mono text-xs tracking-[0.18em] uppercase">
              Evidence-backed review · {report.capturedAt}
            </p>
            <h1 className="mt-4 max-w-4xl text-3xl leading-tight font-semibold tracking-tight sm:text-5xl">
              {report.title}
            </h1>
            <p className="text-muted-foreground mt-5 max-w-3xl text-base leading-7">
              {report.summary}
            </p>
          </div>
          <dl className="border-border bg-card grid grid-cols-2 rounded-xl border">
            <div className="border-border border-r p-5">
              <dt className="text-muted-foreground font-mono text-xs uppercase">Findings</dt>
              <dd className="mt-2 text-3xl font-semibold">{report.findings.length}</dd>
            </div>
            <div className="p-5">
              <dt className="text-muted-foreground font-mono text-xs uppercase">Panels affected</dt>
              <dd className="mt-2 text-3xl font-semibold">{issueCount}</dd>
            </div>
            <div className="border-border col-span-2 border-t p-5">
              <dt className="text-muted-foreground font-mono text-xs uppercase">Scope</dt>
              <dd className="mt-2 text-sm leading-6">{report.scope}</dd>
            </div>
          </dl>
        </header>

        <section aria-labelledby="coverage-heading" className="py-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-muted-foreground font-mono text-xs tracking-[0.18em] uppercase">
                Inspection matrix
              </p>
              <h2 id="coverage-heading" className="mt-2 text-2xl font-semibold">
                Every panel accounted for
              </h2>
            </div>
            <p className="text-muted-foreground text-sm">Issue means a panel-specific defect.</p>
          </div>
          <div className="mt-5 grid gap-px overflow-hidden rounded-xl border sm:grid-cols-2 xl:grid-cols-4">
            {report.coverage.map((item) => (
              <a
                className="bg-card hover:bg-accent group min-h-36 p-5 transition-colors"
                href={item.evidenceSrc}
                key={item.label}
              >
                <span className={item.status === 'issue' ? 'text-red-300' : 'text-emerald-300'}>
                  {item.status === 'issue' ? '● Issue' : '● Passed layout'}
                </span>
                <h3 className="mt-5 font-semibold">{item.label}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-5">{item.outcome}</p>
              </a>
            ))}
          </div>
        </section>

        <section aria-labelledby="findings-heading" className="border-t pt-10">
          <p className="text-muted-foreground font-mono text-xs tracking-[0.18em] uppercase">
            Findings
          </p>
          <h2 id="findings-heading" className="mt-2 text-2xl font-semibold">
            Inspect the evidence, then reproduce it
          </h2>

          <div className="mt-8 space-y-8">
            {report.findings.map((finding) => (
              <article
                className="border-border bg-card overflow-hidden rounded-xl border"
                id={finding.id}
                key={finding.id}
              >
                <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_22rem]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        className="text-muted-foreground font-mono text-xs hover:underline"
                        href={`#${finding.id}`}
                      >
                        {finding.id}
                      </a>
                      <span
                        className={`rounded-full border px-2.5 py-1 font-mono text-[0.6875rem] font-semibold uppercase ${severityStyles[finding.severity]}`}
                      >
                        {finding.severity}
                      </span>
                    </div>
                    <h3 className="mt-4 text-xl font-semibold sm:text-2xl">{finding.title}</h3>
                    <p className="text-muted-foreground mt-4 text-sm leading-6">{finding.actual}</p>
                  </div>
                  <dl className="border-border grid content-start gap-4 border-l pl-5 text-sm">
                    <div>
                      <dt className="text-muted-foreground font-mono text-xs uppercase">URL</dt>
                      <dd className="mt-1 break-all">
                        <a
                          className="text-cyan-300 underline decoration-cyan-300/30 underline-offset-4"
                          href={finding.sourceUrl}
                        >
                          {finding.sourceUrl}
                        </a>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground font-mono text-xs uppercase">
                        Viewport
                      </dt>
                      <dd className="mt-1">{finding.viewport}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground font-mono text-xs uppercase">State</dt>
                      <dd className="mt-1">{finding.state}</dd>
                    </div>
                  </dl>
                </div>

                <div className="border-border grid border-t lg:grid-cols-2">
                  <div className="p-5 sm:p-7">
                    <p className="text-muted-foreground font-mono text-xs uppercase">Expected</p>
                    <p className="mt-2 text-sm leading-6">{finding.expected}</p>
                  </div>
                  <div className="border-border border-t p-5 sm:p-7 lg:border-t-0 lg:border-l">
                    <p className="text-muted-foreground font-mono text-xs uppercase">Reproduce</p>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6">
                      {finding.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>
                </div>

                <div className="border-border bg-background/50 grid gap-4 border-t p-3 sm:p-4">
                  {finding.evidence.map((evidence) => (
                    <figure
                      className="mx-auto w-full max-w-5xl overflow-hidden rounded-lg border"
                      key={evidence.src}
                    >
                      <a href={evidence.src}>
                        <Image
                          alt={evidence.alt}
                          className="mx-auto h-auto max-w-full"
                          height={evidence.height}
                          priority={finding.id === 'H-01'}
                          src={evidence.src}
                          width={evidence.width}
                        />
                      </a>
                      <figcaption className="border-border text-muted-foreground border-t px-4 py-3 text-xs leading-5">
                        {evidence.caption} Open the image for full resolution.
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
