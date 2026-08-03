'use client'

import {
  composeRenderProps,
  SeparatorContext,
  ToggleButtonGroupContext,
  Toolbar as ToolbarPrimitive,
} from 'react-aria-components'

import { cn } from '../../utilities/utils.js'

export type ToolbarProps = React.ComponentProps<typeof ToolbarPrimitive>

function Toolbar({ className, orientation = 'horizontal', ...props }: ToolbarProps) {
  return (
    <ToggleButtonGroupContext.Provider value={{ orientation }}>
      <SeparatorContext.Provider
        value={{ orientation: orientation === 'horizontal' ? 'vertical' : 'horizontal' }}
      >
        <ToolbarPrimitive
          {...props}
          data-slot="toolbar"
          orientation={orientation}
          className={composeRenderProps(className, (className) =>
            cn(
              'flex w-fit flex-wrap gap-(--picodash-space-1-5) data-[orientation=horizontal]:flex-row data-[orientation=horizontal]:items-center data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-start',
              className,
            ),
          )}
        />
      </SeparatorContext.Provider>
    </ToggleButtonGroupContext.Provider>
  )
}

export { Toolbar }
