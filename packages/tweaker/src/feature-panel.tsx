import { AnimatePresence, motion, type HTMLMotionProps, type Transition } from 'motion/react'
import type { ReactNode } from 'react'
import { tweakerMotionTokens } from './theme.js'
import { TweakerThemeContextProvider, useResolvedTweakerTheme } from './tweaker-theme-context.js'

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
  theme: themeProp,
  ...props
}: FeaturePanelProps) {
  const theme = useResolvedTweakerTheme(themeProp)

  return (
    <TweakerThemeContextProvider theme={theme}>
      <motion.section
        {...props}
        initial={tweakerMotionTokens.featurePanelInitial}
        animate={tweakerMotionTokens.featurePanelAnimate}
        transition={panelTransition}
        data-tweaker-theme={theme}
        className={joinClassNames(
          'overflow-hidden rounded-tweaker-surface border border-tweaker-border bg-tweaker-surface/90 text-tweaker-text shadow-tweaker-panel ring-1 ring-(--_tweaker-panel-ring) backdrop-blur-(--tweaker-blur-surface)',
          className,
        )}
      >
        <div className="border-tweaker-border border-b px-(--tweaker-space-5) py-(--tweaker-space-4)">
          {eyebrow ? (
            <p className="text-tweaker-success text-(length:--tweaker-font-size-lg) font-(--tweaker-font-semibold) tracking-(--tweaker-tracking-wide) uppercase">
              {eyebrow}
            </p>
          ) : null}
          <div className="mt-(--tweaker-space-2) flex items-start justify-between gap-(--tweaker-space-4)">
            <div>
              <h2 className="text-(length:--tweaker-font-size-2xl) font-(--tweaker-font-semibold) tracking-(--tweaker-tracking-normal) text-(--tweaker-color-text-strong)">
                {title}
              </h2>
              {summary ? (
                <p className="text-tweaker-muted mt-(--tweaker-space-1) text-(length:--tweaker-font-size-xl) leading-(--tweaker-line-relaxed)">
                  {summary}
                </p>
              ) : null}
            </div>
            {metric ? (
              <motion.div
                layout
                whileHover={tweakerMotionTokens.featureMetricHover}
                transition={rowTransition}
                className="rounded-tweaker-control text-tweaker-canvas shrink-0 bg-(--tweaker-color-text-strong) px-(--tweaker-space-3) py-(--tweaker-space-2) text-right"
              >
                <p className="text-tweaker-muted text-(length:--tweaker-font-size-lg) font-(--tweaker-font-medium)">
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
                  <p className="text-(length:--tweaker-font-size-lg) font-(--tweaker-font-medium) text-(--_tweaker-color-success-strong)">
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
                    <span className="text-tweaker-text truncate text-(length:--tweaker-font-size-xl) font-(--tweaker-font-medium)">
                      {item.label}
                    </span>
                  </span>
                  <span className="text-tweaker-muted text-(length:--tweaker-font-size-xl)">
                    {item.value}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : null}

        {footer ? (
          <div className="border-tweaker-border text-tweaker-muted border-t px-(--tweaker-space-5) py-(--tweaker-space-3) text-(length:--tweaker-font-size-xl)">
            {footer}
          </div>
        ) : null}
      </motion.section>
    </TweakerThemeContextProvider>
  )
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ')
}
