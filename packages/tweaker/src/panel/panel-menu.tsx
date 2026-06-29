import { type RefObject } from "react";
import { ChevronRight, Ellipsis } from "lucide-react";
import {
  Button,
  Header,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Popover,
  SubmenuTrigger,
} from "react-aria-components";
import type { DockEdge, DockState, JsonValue } from "../types.js";
import { usePanelEffects } from "./panel-effects-context.js";

interface PanelMenuProps {
  panelId: string;
  panelRef: RefObject<HTMLElement | null>;
  title: string;
  dock: DockState | null;
  valuesById: Record<string, JsonValue>;
  resetValues: (panelId?: string) => void;
  resetOrder: (panelId?: string) => void;
  setDock: (panelId: string, dock: DockState | null) => void;
  setAllSectionsCollapsed: (panelId: string, collapsed: boolean) => void;
  /** Report open/close so the panel can keep its hover/active surface while the menu is open. */
  onOpenChange: (interactionId: string, active: boolean) => void;
}

const DOCK_EDGES: Array<{ edge: DockEdge; id: string; label: string }> = [
  { edge: "top", id: "dock-top", label: "Dock to top" },
  { edge: "right", id: "dock-right", label: "Dock to right" },
  { edge: "bottom", id: "dock-bottom", label: "Dock to bottom" },
  { edge: "left", id: "dock-left", label: "Dock to left" },
];

function CheckableMenuLabel({ active, children }: { active: boolean; children: string }) {
  return (
    <>
      <span className="tw-menu__check" aria-hidden="true">
        {active ? "\u2713" : ""}
      </span>
      <span className="tw-menu__label">{children}</span>
    </>
  );
}

export function PanelMenu({
  panelId,
  panelRef,
  dock,
  valuesById,
  resetValues,
  resetOrder,
  setDock,
  setAllSectionsCollapsed,
  onOpenChange,
}: PanelMenuProps) {
  const panelEffects = usePanelEffects();

  function dockToEdge(edge: DockEdge) {
    // Synthesize a DockState using the panel's current cross-axis position as
    // the offset, so docking from the menu keeps the panel roughly where it is
    // instead of jumping to offset 0.
    const rect = panelRef.current?.getBoundingClientRect();
    const offset = edge === "top" || edge === "bottom" ? (rect?.x ?? 0) : (rect?.y ?? 0);
    setDock(panelId, { edge, offset });
  }

  async function copyValues() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(valuesById));
    } catch {
      // Clipboard may be unavailable (permissions, non-secure context); no-op.
    }
  }

  return (
    <MenuTrigger onOpenChange={(open) => onOpenChange("panel-menu", open)}>
      <Button
        className="tw-icon-button tw-panel__menu-trigger"
        type="button"
        aria-label={`Panel menu`}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Ellipsis size={15} />
      </Button>
      <Popover
        className="tw-menu__popover"
        style={panelEffects.style}
        data-theme={panelEffects.theme}
        placement="bottom end"
        onPointerDown={(event) => event.stopPropagation()}
        onPointerMove={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
        onPointerCancel={(event) => event.stopPropagation()}
      >
        <Menu className="tw-menu" selectionMode="none">
          <MenuSection className="tw-menu__section">
            <Header className="tw-menu__section-header">Actions</Header>
            <MenuItem
              className="tw-menu__item"
              id="collapse-all"
              onAction={() => setAllSectionsCollapsed(panelId, true)}
            >
              Collapse all sections
            </MenuItem>
            <MenuItem
              className="tw-menu__item"
              id="expand-all"
              onAction={() => setAllSectionsCollapsed(panelId, false)}
            >
              Expand all sections
            </MenuItem>
            <MenuItem className="tw-menu__item" id="copy-values" onAction={copyValues}>
              Copy values as JSON
            </MenuItem>
          </MenuSection>

          {/* Reset actions live behind a submenu so a stray click can't wipe
              values or row order. */}
          <MenuSection className="tw-menu__section">
            <SubmenuTrigger>
              <MenuItem id="reset-trigger" className="tw-menu__item">
                <span>Reset…</span>
                <ChevronRight size={13} aria-hidden className="tw-menu__chevron" />
              </MenuItem>
              <Popover
                className="tw-menu__popover"
                style={panelEffects.style}
                data-theme={panelEffects.theme}
                placement="right top"
                onPointerDown={(event) => event.stopPropagation()}
                onPointerMove={(event) => event.stopPropagation()}
                onPointerUp={(event) => event.stopPropagation()}
                onPointerCancel={(event) => event.stopPropagation()}
              >
                <Menu className="tw-menu" selectionMode="none">
                  <MenuItem
                    className="tw-menu__item"
                    id="reset-values"
                    onAction={() => resetValues(panelId)}
                  >
                    Reset values
                  </MenuItem>
                  <MenuItem
                    className="tw-menu__item"
                    id="reset-order"
                    onAction={() => resetOrder(panelId)}
                  >
                    Reset row order
                  </MenuItem>
                  <MenuItem
                    className="tw-menu__item tw-menu__item--danger"
                    id="reset-all"
                    onAction={() => {
                      resetValues(panelId);
                      resetOrder(panelId);
                    }}
                  >
                    Reset all
                  </MenuItem>
                </Menu>
              </Popover>
            </SubmenuTrigger>
          </MenuSection>

          <MenuSection className="tw-menu__section">
            <Header className="tw-menu__section-header">Sticky edges</Header>
            {DOCK_EDGES.map(({ edge, id, label }) => {
              const active = dock?.edge === edge && !dock?.secondaryEdge;
              return (
                <MenuItem
                  key={id}
                  id={id}
                  className="tw-menu__item tw-menu__item--checkable"
                  data-active={active ? "true" : undefined}
                  onAction={() => dockToEdge(edge)}
                >
                  <CheckableMenuLabel active={active}>{label}</CheckableMenuLabel>
                </MenuItem>
              );
            })}
            <MenuItem
              id="float"
              className="tw-menu__item tw-menu__item--checkable"
              data-active={dock === null ? "true" : undefined}
              onAction={() => setDock(panelId, null)}
            >
              <CheckableMenuLabel active={dock === null}>Float (unpin)</CheckableMenuLabel>
            </MenuItem>
          </MenuSection>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
