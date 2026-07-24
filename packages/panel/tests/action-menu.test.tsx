import { CircleGauge } from 'lucide-react'
import { expect, test } from 'vite-plus/test'
import {
  ActionMenuItem,
  ActionMenuSeparator,
  ActionSubmenu,
  CollapseAllItem,
  CopyJsonItem,
  CopySubmenu,
  CopyYamlItem,
  ExpandAllItem,
  ExportJsonItem,
  ExportSubmenu,
  ExportYamlItem,
  ImportItem,
  PicodashPanel,
  ResetItem,
  type ActionMenuConfirmation,
  type ActionMenuItemProps,
  type ActionSubmenuProps,
  type PicodashPanelActionMenu,
} from '../src/index.ts'
import {
  actionMenuConfirmationForDestructive,
  resolvePicodashPanelActionMenu,
} from '../src/picodash-panel-actions.tsx'
import { panelShouldRenderHeader } from '../src/picodash-panel.tsx'

test('exports the composable action-menu surface', () => {
  expect(ActionMenuItem).toBeTypeOf('function')
  expect(ActionMenuSeparator).toBeTypeOf('function')
  expect(ActionSubmenu).toBeTypeOf('function')
  expect(ExpandAllItem).toBeTypeOf('function')
  expect(CollapseAllItem).toBeTypeOf('function')
  expect(CopyJsonItem).toBeTypeOf('function')
  expect(CopyYamlItem).toBeTypeOf('function')
  expect(ExportJsonItem).toBeTypeOf('function')
  expect(ExportYamlItem).toBeTypeOf('function')
  expect(ImportItem).toBeTypeOf('function')
  expect(ResetItem).toBeTypeOf('function')
  expect(CopySubmenu).toBeTypeOf('function')
  expect(ExportSubmenu).toBeTypeOf('function')
})

test('resolves omitted, disabled, replacement, and root-submenu action menus', () => {
  const defaultMenu = resolvePicodashPanelActionMenu(undefined, 'Scene')
  expect(defaultMenu?.type).toBe(ActionSubmenu)
  expect(defaultMenu?.props.label).toBe('Actions for Scene')
  expect(defaultMenu?.props.icon).toBeUndefined()
  expect(defaultMenu?.props.triggerLabel).toBe('Open actions for Scene')

  expect(resolvePicodashPanelActionMenu(false, 'Scene')).toBeNull()

  const unkeyedRow = (
    <ActionMenuItem icon={CircleGauge} label="Inspect" onAction={() => undefined} />
  )
  const keyedRow = <ActionMenuSeparator key="separator" />
  const rows = [unkeyedRow, keyedRow]
  const replacementMenu = resolvePicodashPanelActionMenu(rows, 'Scene')
  const replacementRows = replacementMenu?.props.children as typeof rows
  expect(replacementMenu?.type).toBe(ActionSubmenu)
  expect(replacementRows[0]?.key).toBe('0')
  expect(replacementRows[0]).not.toBe(unkeyedRow)
  expect(replacementRows[1]).toBe(keyedRow)

  const customRoot = (
    <ActionSubmenu icon={CircleGauge} label="Scene tools">
      <ActionMenuItem label="Inspect" onAction={() => undefined} />
    </ActionSubmenu>
  )
  expect(resolvePicodashPanelActionMenu(customRoot, 'Scene')).toBe(customRoot)
  expect(customRoot.props.icon).toBe(CircleGauge)
  expect(() => resolvePicodashPanelActionMenu(<ActionMenuItem label="Invalid" />, 'Scene')).toThrow(
    'actionMenu must be false, an item array, or an ActionSubmenu',
  )
})

test('turns a destructive tuple into deferred confirmation details', () => {
  const onAction = () => undefined
  const confirmation = actionMenuConfirmationForDestructive(
    ['This cannot be undone.', 'Delete scene?'],
    'Delete…',
    onAction,
  )

  expect(confirmation).toEqual({
    description: 'This cannot be undone.',
    label: 'Confirm',
    onAction,
    title: 'Delete scene?',
  })
  expect(
    actionMenuConfirmationForDestructive(['This cannot be undone.'], 'Delete item', onAction),
  ).toMatchObject({
    description: 'This cannot be undone.',
    label: 'Confirm',
    title: 'Delete item',
  })
  expect(
    actionMenuConfirmationForDestructive(
      ['This cannot be undone.', 'Reset scene?', 'Reset values'],
      'Reset…',
      onAction,
    )?.label,
  ).toBe('Reset values')
  expect(
    actionMenuConfirmationForDestructive(['This cannot be undone.'], 'Delete', undefined),
  ).toBeNull()
})

test('keeps the default menu available on otherwise headerless panels', () => {
  expect(
    panelShouldRenderHeader({
      actionMenu: undefined,
      close: false,
      collapsible: false,
      fixedPlacement: false,
      title: undefined,
    }),
  ).toBe(true)
  expect(
    panelShouldRenderHeader({
      actionMenu: false,
      close: false,
      collapsible: false,
      fixedPlacement: false,
      title: undefined,
    }),
  ).toBe(false)
})

const confirmation: ActionMenuConfirmation = ['This cannot be undone.', 'Remove item?']
const itemProps: ActionMenuItemProps = {
  destructive: confirmation,
  icon: CircleGauge,
  label: 'Remove',
  onAction: () => undefined,
}
const submenuProps: ActionSubmenuProps = {
  children: <ActionMenuItem {...itemProps} />,
  icon: CircleGauge,
  label: 'Tools',
}
const replacementMenu: PicodashPanelActionMenu = [
  <ActionMenuItem key="remove" {...itemProps} />,
  <ActionMenuSeparator key="separator" />,
  <ActionSubmenu key="tools" {...submenuProps} />,
]
const rootSubmenu: PicodashPanelActionMenu = <ActionSubmenu {...submenuProps} />

void (
  <>
    <PicodashPanel actionMenu={false} id="disabled" />
    <PicodashPanel actionMenu={replacementMenu} id="replacement" />
    <PicodashPanel actionMenu={rootSubmenu} id="submenu" />
  </>
)

// @ts-expect-error Icons are Lucide component types, not rendered elements.
const invalidIconProps: ActionMenuItemProps = { icon: <CircleGauge />, label: 'Invalid' }

void invalidIconProps
