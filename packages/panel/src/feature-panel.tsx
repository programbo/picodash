import { AnimatePresence, motion, type HTMLMotionProps, type Transition } from 'motion/react'
import type { ReactNode } from 'react'
import { tweakerDefaultTheme, tweakerMotionTokens } from './theme.js'

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
  neutral: 'bg-tweaker-muted',
  success: 'bg-tweaker-success',
  warning: 'bg-tweaker-warning',
  info: 'bg-tweaker-info',
}

const panelTransition: Transition = tweakerMotionTokens.featurePanelEnter
const rowTransition: Transition = tweakerMotionTokens.featureRow

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
      initial={tweakerMotionTokens.featurePanelInitial}
      animate={tweakerMotionTokens.featurePanelAnimate}
      transition={panelTransition}
      data-tweaker-theme={tweakerDefaultTheme}
      className={joinClassNames(
        'overflow-hidden rounded-(--tweaker-feature-radius) border border-(--tweaker-feature-border) bg-(--tweaker-feature-background) text-(--tweaker-feature-foreground) shadow-tweaker-panel ring-1 ring-(--tweaker-panel-ring) backdrop-blur-(--tweaker-blur-surface)',
        className,
      )}
      {...props}
    >
      <div className="border-tweaker-border border-b px-(--tweaker-space-5) py-(--tweaker-space-4)">
        {eyebrow ? (
          <p className="text-(length:--tweaker-font-size-lg) font-(--tweaker-font-semibold) tracking-(--tweaker-tracking-wide) text-(--tweaker-feature-eyebrow) uppercase">
            {eyebrow}
          </p>
        ) : null}
        <div className="mt-(--tweaker-space-2) flex items-start justify-between gap-(--tweaker-space-4)">
          <div>
            <h2 className="text-(length:--tweaker-font-size-2xl) font-(--tweaker-font-semibold) tracking-(--tweaker-tracking-normal) text-(--tweaker-color-text-strong)">
              {title}
            </h2>
            {summary ? (
              <p className="mt-(--tweaker-space-1) text-(length:--tweaker-font-size-xl) leading-(--tweaker-line-relaxed) text-(--tweaker-feature-muted)">
                {summary}
              </p>
            ) : null}
          </div>
          {metric ? (
            <motion.div
              layout
              whileHover={tweakerMotionTokens.featureMetricHover}
              transition={rowTransition}
              className="shrink-0 rounded-(--tweaker-button-radius) bg-(--tweaker-feature-metric-background) px-(--tweaker-space-3) py-(--tweaker-space-2) text-right text-(--tweaker-feature-metric-foreground)"
            >
              <p className="text-(length:--tweaker-font-size-lg) font-(--tweaker-font-medium) text-(--tweaker-feature-metric-label)">
                {metric.label}
              </p>
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={metric.value}
                  initial={tweakerMotionTokens.featureMetricEnter}
                  animate={tweakerMotionTokens.featureMetricAnimate}
                  exit={tweakerMotionTokens.featureMetricExit}
                  transition={tweakerMotionTokens.quickFade}
                  className="text-(length:--tweaker-font-size-3xl) font-(--tweaker-font-semibold) tracking-(--tweaker-tracking-normal)"
                >
                  {metric.value}
                </motion.p>
              </AnimatePresence>
              {metric.trend ? (
                <p className="text-(length:--tweaker-font-size-lg) font-(--tweaker-font-medium) text-(--tweaker-feature-trend)">
                  {metric.trend}
                </p>
              ) : null}
            </motion.div>
          ) : null}
        </div>
      </div>

      {items.length > 0 ? (
        <ul className="divide-tweaker-border divide-y overflow-hidden">
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <motion.li
                key={item.label}
                layout
                initial={tweakerMotionTokens.featureRowInitial}
                animate={tweakerMotionTokens.featureRowAnimate}
                exit={tweakerMotionTokens.featureRowExit}
                transition={rowTransition}
                className="flex items-center justify-between gap-(--tweaker-space-4) px-(--tweaker-space-5) py-(--tweaker-space-4)"
              >
                <span className="flex min-w-0 items-center gap-(--tweaker-space-3)">
                  <motion.span
                    layout
                    className={joinClassNames(
                      'size-(--tweaker-space-2-5) shrink-0 rounded-full',
                      statusClasses[item.status ?? 'neutral'],
                    )}
                  />
                  <span className="truncate text-(length:--tweaker-font-size-xl) font-(--tweaker-font-medium) text-(--tweaker-feature-foreground)">
                    {item.label}
                  </span>
                </span>
                <span className="text-(length:--tweaker-font-size-xl) text-(--tweaker-feature-subtle)">
                  {item.value}
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : null}

      {footer ? (
        <div className="border-tweaker-border border-t px-(--tweaker-space-5) py-(--tweaker-space-3) text-(length:--tweaker-font-size-xl) text-(--tweaker-feature-subtle)">
          {footer}
        </div>
      ) : null}
    </motion.section>
  )
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ')
}
