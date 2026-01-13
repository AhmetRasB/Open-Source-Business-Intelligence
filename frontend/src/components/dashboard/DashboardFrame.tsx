import { useMemo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { ActionIcon, Group, Paper, Text, Tooltip } from '@mantine/core'
import { IconChevronLeft, IconChevronRight, IconLayoutSidebarLeftCollapse, IconLayoutSidebarRightCollapse } from '@tabler/icons-react'

import { useDashboardStore } from '../../stores/dashboardStore'
import { RibbonBar } from './RibbonBar'
import { SidebarPane } from './SidebarPane'
import type { GridSettings } from '../designer/DesignerCanvas'
import { DesignerCanvas } from '../designer/DesignerCanvas'

export function DashboardFrame({
  interactive,
  gridSettings,
  canvasRef,
}: {
  interactive: boolean
  gridSettings: GridSettings
  canvasRef?: (node: HTMLDivElement | null) => void
}) {
  const chrome = useDashboardStore((s) => s.chrome)
  const enableRibbon = useDashboardStore((s) => s.enableRibbon)
  const enableSidebar = useDashboardStore((s) => s.enableSidebar)
  const toggleSidebarCollapsed = useDashboardStore((s) => s.toggleSidebarCollapsed)

  const ribbonDrop = useDroppable({ id: 'ribbon-drop', disabled: !interactive })
  const sidebarDrop = useDroppable({ id: 'sidebar-drop', disabled: !interactive })

  const hasRibbon = chrome.ribbon.enabled
  const hasSidebar = chrome.sidebar.enabled

  const sidebarNode =
    hasSidebar || interactive ? (
      <div
        ref={sidebarDrop.setNodeRef}
        className="h-full"
        style={{
          width: hasSidebar ? (chrome.sidebar.collapsed ? 44 : chrome.sidebar.width) : 220,
          order: chrome.sidebar.side === 'left' ? 0 : 2,
          minHeight: 0,
        }}
      >
        {hasSidebar ? (
          <SidebarPane interactive={interactive} />
        ) : (
          <Paper withBorder p="xs" className="h-full">
            <Group justify="space-between">
              <Text fw={700} size="sm">
                Sidebar
              </Text>
              <ButtonCompact onClick={() => enableSidebar(true)} label="Enable sidebar" />
            </Group>
            <Text size="sm" c="dimmed" mt="xs">
              Drop “KPI” or “Filter pane” here.
            </Text>
          </Paper>
        )}
      </div>
    ) : null

  const ribbonNode =
    hasRibbon || interactive ? (
      <div ref={ribbonDrop.setNodeRef} style={{ position: 'sticky', top: 0, zIndex: 20 }}>
        {hasRibbon ? (
          <RibbonBar interactive={interactive} />
        ) : (
          <Paper withBorder p="xs">
            <Group justify="space-between">
              <Text fw={700} size="sm">
                Ribbon
              </Text>
              <ButtonCompact onClick={() => enableRibbon(true)} label="Enable ribbon" />
            </Group>
            <Text size="sm" c="dimmed" mt="xs">
              Drop “KPI” or “Filter pane” here (stays visible while scrolling).
            </Text>
          </Paper>
        )}
      </div>
    ) : null

  const canvasWrapperStyle = useMemo(
    () => ({
      order: 1 as const,
      flex: 1,
      minWidth: 0,
      minHeight: 0,
    }),
    [],
  )

  return (
    <div className="h-full w-full flex flex-col" style={{ minHeight: 0 }}>
      {ribbonNode}

      <div className="flex flex-1 min-h-0 gap-3">
        {sidebarNode}

        <div ref={canvasRef} style={canvasWrapperStyle}>
          {hasSidebar ? (
            <Group justify="flex-end" mb="xs">
              <Tooltip label={chrome.sidebar.collapsed ? 'Open sidebar' : 'Collapse sidebar'}>
                <ActionIcon variant="subtle" onClick={toggleSidebarCollapsed} aria-label="Toggle sidebar">
                  {chrome.sidebar.side === 'left' ? (
                    chrome.sidebar.collapsed ? (
                      <IconChevronRight size={16} />
                    ) : (
                      <IconLayoutSidebarLeftCollapse size={16} />
                    )
                  ) : chrome.sidebar.collapsed ? (
                    <IconChevronLeft size={16} />
                  ) : (
                    <IconLayoutSidebarRightCollapse size={16} />
                  )}
                </ActionIcon>
              </Tooltip>
            </Group>
          ) : null}

          <DesignerCanvas droppableId={interactive ? 'canvas' : 'preview-canvas'} gridSettings={gridSettings} interactive={interactive} />
        </div>
      </div>
    </div>
  )
}

function ButtonCompact({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Tooltip label={label}>
      <ActionIcon variant="light" onClick={onClick} aria-label={label}>
        +
      </ActionIcon>
    </Tooltip>
  )
}

