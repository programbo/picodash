export type GuideSideNavLink = {
  href: string
  label: string
  meta?: string
}

export function GuideSideNav({
  ariaLabel,
  description,
  links,
  title,
}: {
  ariaLabel: string
  description: string
  links: readonly GuideSideNavLink[]
  title: string
}) {
  return (
    <aside className="lg:sticky lg:top-8 lg:self-start">
      <p className="font-mono text-[11px] tracking-widest text-amber-200 uppercase">{title}</p>
      <nav aria-label={ariaLabel} className="mt-4">
        <ol className="grid max-h-[min(32rem,calc(100svh-22rem))] gap-px overflow-y-auto border border-white/10 bg-white/10">
          {links.map((link, index) => (
            <li key={link.href}>
              <a
                className="group flex gap-3 bg-zinc-950 px-3 py-2.5 text-xs leading-5 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:outline-none"
                href={link.href}
              >
                <span className="font-mono text-amber-200/70">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0">
                  <span className="block">{link.label}</span>
                  {link.meta ? (
                    <span className="block truncate font-mono text-[10px] text-zinc-600">
                      {link.meta}
                    </span>
                  ) : null}
                </span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <p className="mt-4 text-xs leading-5 text-zinc-500">{description}</p>
    </aside>
  )
}
