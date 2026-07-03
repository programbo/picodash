import { AnimatePresence, motion, type HTMLMotionProps, type Transition } from 'motion/react'
import type { ReactNode } from 'react'

export type FeaturePanelItemStatus = 'neutral' | 'success' | 'warning' | 'info'

export interface FeaturePanelItem {
  label: string
  value: string
  status?: FeaturePanelItemStatus
}

export interface FeaturePanelMetric {
  label: string
  value: string
  trend?: string
}

export interface FeaturePanelProps extends Omit<HTMLMotionProps<'section'>, 'title'> {
  eyebrow?: string
  title: string
  summary?: string
  metric?: FeaturePanelMetric
  items?: FeaturePanelItem[]
  footer?: ReactNode
}

const statusClasses: Record<FeaturePanelItemStatus, string> = {
  neutral: 'bg-zinc-400',
  success: 'bg-emerald-400',
  warning: 'bg-amber-300',
  info: 'bg-sky-300',
}

const panelTransition: Transition = { duration: 0.32, ease: [0.22, 1, 0.36, 1] }
const rowTransition: Transition = { type: 'spring', stiffness: 420, damping: 34 }

export function FeaturePanel({
  eyebrow,
  title,
  summary,
  metric,
  items = [],
  footer,
  className,
  ...props
}: FeaturePanelProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={panelTransition}
      className={joinClassNames(
        'overflow-hidden rounded-lg border border-white/12 bg-zinc-900/90 text-zinc-100 shadow-2xl shadow-black/30 ring-1 ring-white/5 backdrop-blur',
        className,
      )}
      {...props}
    >
      <div className="border-b border-white/10 px-5 py-4">
        {eyebrow ? (
          <p className="text-xs font-semibold tracking-wide text-emerald-200 uppercase">
            {eyebrow}
          </p>
        ) : null}
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-normal text-white">{title}</h2>
            {summary ? <p className="mt-1 text-sm leading-6 text-zinc-300">{summary}</p> : null}
          </div>
          {metric ? (
            <motion.div
              layout
              whileHover={{ y: -2 }}
              transition={rowTransition}
              className="shrink-0 rounded-md bg-white px-3 py-2 text-right text-zinc-950"
            >
              <p className="text-xs font-medium text-zinc-500">{metric.label}</p>
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={metric.value}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                  className="text-2xl font-semibold tracking-normal"
                >
                  {metric.value}
                </motion.p>
              </AnimatePresence>
              {metric.trend ? (
                <p className="text-xs font-medium text-emerald-700">{metric.trend}</p>
              ) : null}
            </motion.div>
          ) : null}
        </div>
      </div>

      {items.length > 0 ? (
        <ul className="divide-y divide-white/10 overflow-hidden">
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <motion.li
                key={item.label}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={rowTransition}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <motion.span
                    layout
                    className={joinClassNames(
                      'size-2.5 shrink-0 rounded-full',
                      statusClasses[item.status ?? 'neutral'],
                    )}
                  />
                  <span className="truncate text-sm font-medium text-zinc-200">{item.label}</span>
                </span>
                <span className="text-sm text-zinc-400">{item.value}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : null}

      {footer ? (
        <div className="border-t border-white/10 px-5 py-3 text-sm text-zinc-400">{footer}</div>
      ) : null}
    </motion.section>
  )
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ')
}
