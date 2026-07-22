import { AnimatePresence, motion, type HTMLMotionProps, type Transition } from 'motion/react'
import type { ReactNode } from 'react'
import { picodashMotionTokens } from './theme.js'
import { PicodashThemeContextProvider, useResolvedPicodashTheme } from './picodash-theme-context.js'

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
  theme?: string
}

const statusClasses: Record<FeaturePanelItemStatus, string> = {
  neutral: 'bg-picodash-muted',
  success: 'bg-picodash-success',
  warning: 'bg-picodash-warning',
  info: 'bg-picodash-info',
}

const panelTransition: Transition = picodashMotionTokens.featurePanelEnter
const rowTransition: Transition = picodashMotionTokens.featureRow

export function FeaturePanel({
  eyebrow,
  title,
  summary,
  metric,
  items = [],
  footer,
  className,
  theme: themeProp,
  ...props
}: FeaturePanelProps) {
  const theme = useResolvedPicodashTheme(themeProp)

  return (
    <PicodashThemeContextProvider theme={theme}>
      <motion.section
        {...props}
        initial={picodashMotionTokens.featurePanelInitial}
        animate={picodashMotionTokens.featurePanelAnimate}
        transition={panelTransition}
        data-picodash-theme={theme}
        className={joinClassNames(
          'overflow-hidden rounded-picodash-surface border border-picodash-border bg-picodash-surface/90 text-picodash-text shadow-picodash-panel ring-1 ring-(--_picodash-panel-ring) backdrop-blur-(--picodash-blur-surface)',
          className,
        )}
      >
        <div className="border-picodash-border border-b px-(--picodash-space-5) py-(--picodash-space-4)">
          {eyebrow ? (
            <p className="text-picodash-success text-(length:--picodash-font-size-lg) font-(--picodash-font-semibold) tracking-(--picodash-tracking-wide) uppercase">
              {eyebrow}
            </p>
          ) : null}
          <div className="mt-(--picodash-space-2) flex items-start justify-between gap-(--picodash-space-4)">
            <div>
              <h2 className="text-(length:--picodash-font-size-2xl) font-(--picodash-font-semibold) tracking-(--picodash-tracking-normal) text-(--picodash-color-text-strong)">
                {title}
              </h2>
              {summary ? (
                <p className="text-picodash-muted mt-(--picodash-space-1) text-(length:--picodash-font-size-xl) leading-(--picodash-line-relaxed)">
                  {summary}
                </p>
              ) : null}
            </div>
            {metric ? (
              <motion.div
                layout
                whileHover={picodashMotionTokens.featureMetricHover}
                transition={rowTransition}
                className="rounded-picodash-control text-picodash-canvas shrink-0 bg-(--picodash-color-text-strong) px-(--picodash-space-3) py-(--picodash-space-2) text-right"
              >
                <p className="text-picodash-muted text-(length:--picodash-font-size-lg) font-(--picodash-font-medium)">
                  {metric.label}
                </p>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={metric.value}
                    initial={picodashMotionTokens.featureMetricEnter}
                    animate={picodashMotionTokens.featureMetricAnimate}
                    exit={picodashMotionTokens.featureMetricExit}
                    transition={picodashMotionTokens.quickFade}
                    className="text-(length:--picodash-font-size-3xl) font-(--picodash-font-semibold) tracking-(--picodash-tracking-normal)"
                  >
                    {metric.value}
                  </motion.p>
                </AnimatePresence>
                {metric.trend ? (
                  <p className="text-(length:--picodash-font-size-lg) font-(--picodash-font-medium) text-(--_picodash-color-success-strong)">
                    {metric.trend}
                  </p>
                ) : null}
              </motion.div>
            ) : null}
          </div>
        </div>

        {items.length > 0 ? (
          <ul className="divide-picodash-border divide-y overflow-hidden">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <motion.li
                  key={item.label}
                  layout
                  initial={picodashMotionTokens.featureRowInitial}
                  animate={picodashMotionTokens.featureRowAnimate}
                  exit={picodashMotionTokens.featureRowExit}
                  transition={rowTransition}
                  className="flex items-center justify-between gap-(--picodash-space-4) px-(--picodash-space-5) py-(--picodash-space-4)"
                >
                  <span className="flex min-w-0 items-center gap-(--picodash-space-3)">
                    <motion.span
                      layout
                      className={joinClassNames(
                        'size-(--picodash-space-2-5) shrink-0 rounded-full',
                        statusClasses[item.status ?? 'neutral'],
                      )}
                    />
                    <span className="text-picodash-text truncate text-(length:--picodash-font-size-xl) font-(--picodash-font-medium)">
                      {item.label}
                    </span>
                  </span>
                  <span className="text-picodash-muted text-(length:--picodash-font-size-xl)">
                    {item.value}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : null}

        {footer ? (
          <div className="border-picodash-border text-picodash-muted border-t px-(--picodash-space-5) py-(--picodash-space-3) text-(length:--picodash-font-size-xl)">
            {footer}
          </div>
        ) : null}
      </motion.section>
    </PicodashThemeContextProvider>
  )
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ')
}
