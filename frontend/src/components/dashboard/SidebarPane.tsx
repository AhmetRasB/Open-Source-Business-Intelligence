import { useMemo } from 'react'
import { ActionIcon, Group, Paper, Stack, Text, Tooltip } from '@mantine/core'
import { IconChevronLeft, IconChevronRight, IconX } from '@tabler/icons-react'

import { useDashboardStore } from '../../stores/dashboardStore'
import { FilterPaneWidget } from './widgets/FilterPaneWidget'
import { KpiWidget } from './widgets/KpiWidget'
import { ButtonWidget } from './widgets/ButtonWidget'

export function SidebarPane({ interactive }: { interactive: boolean }) {
  const chrome = useDashboardStore((s) => s.chrome)
  const widgets = useDashboardStore((s) => s.widgets)
  const enableSidebar = useDashboardStore((s) => s.enableSidebar)
  const toggleSidebarCollapsed = useDashboardStore((s) => s.toggleSidebarCollapsed)
  const setSidebarSide = useDashboardStore((s) => s.setSidebarSide)
  const removeChromeItem = useDashboardStore((s) => s.removeChromeItem)

  const items = useMemo(() => chrome.sidebar.items.map((id) => widgets[id]).filter(Boolean), [chrome.sidebar.items, widgets])

  if (!chrome.sidebar.enabled) return null

  if (chrome.sidebar.collapsed) {
    return (
      <Paper withBorder className="h-full w-10 flex flex-col items-center justify-start py-2">
        <Tooltip label="Open Sidebar" position={chrome.sidebar.side === 'left' ? 'right' : 'left'}>
          <ActionIcon variant="subtle" onClick={toggleSidebarCollapsed} aria-label="Open sidebar">
            {chrome.sidebar.side === 'left' ? <IconChevronRight size={16} /> : <IconChevronLeft size={16} />}
          </ActionIcon>
        </Tooltip>
      </Paper>
    )
  }

  return (
    <Paper withBorder className="h-full" p="xs" style={{ height: '100%', overflow: 'auto' }}>
      <Group justify="space-between" mb="xs">
        <Text fw={700} size="sm">
          Sidebar
        </Text>
        <Group gap="xs">
          {interactive ? (
            <Tooltip label={chrome.sidebar.side === 'left' ? 'Move sidebar to right' : 'Move sidebar to left'}>
              <ActionIcon
                variant="subtle"
                onClick={() => setSidebarSide(chrome.sidebar.side === 'left' ? 'right' : 'left')}
                aria-label="Toggle sidebar side"
              >
                {chrome.sidebar.side === 'left' ? <IconChevronRight size={16} /> : <IconChevronLeft size={16} />}
              </ActionIcon>
            </Tooltip>
          ) : null}

          <Tooltip label="Collapse sidebar">
            <ActionIcon variant="subtle" onClick={toggleSidebarCollapsed} aria-label="Collapse sidebar">
              {chrome.sidebar.side === 'left' ? <IconChevronLeft size={16} /> : <IconChevronRight size={16} />}
            </ActionIcon>
          </Tooltip>

          {interactive ? (
            <Tooltip label="Disable sidebar">
              <ActionIcon variant="subtle" color="gray" onClick={() => enableSidebar(false)} aria-label="Disable sidebar">
                <IconX size={16} />
              </ActionIcon>
            </Tooltip>
          ) : null}
        </Group>
      </Group>

      <Stack gap="sm">
        {items.length === 0 ? (
          <Text size="sm" c="dimmed">
            Drop “KPI” or “Filter pane” here.
          </Text>
        ) : null}

        {items.map((w) => (
          <Paper key={w!.id} withBorder p="sm">
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={600}>
                {w!.title}
              </Text>
              {interactive ? (
                <Tooltip label="Remove">
                  <ActionIcon variant="subtle" color="red" onClick={() => removeChromeItem(w!.id)} aria-label="Remove">
                    <IconX size={16} />
                  </ActionIcon>
                </Tooltip>
              ) : null}
            </Group>

            {w!.type === 'kpi' ? (
              <KpiWidget id={w!.id} />
            ) : w!.type === 'filterPane' ? (
              <FilterPaneWidget id={w!.id} />
            ) : w!.type === 'button' ? (
              <ButtonWidget id={w!.id} />
            ) : null}
          </Paper>
        ))}
      </Stack>
    </Paper>
  )
}

