import { useMemo } from 'react'
import { ActionIcon, Group, Paper, Text, Tooltip } from '@mantine/core'
import { IconX } from '@tabler/icons-react'

import { useDashboardStore } from '../../stores/dashboardStore'
import { FilterPaneWidget } from './widgets/FilterPaneWidget'
import { KpiWidget } from './widgets/KpiWidget'
import { ButtonWidget } from './widgets/ButtonWidget'

export function RibbonBar({ interactive }: { interactive: boolean }) {
  const chrome = useDashboardStore((s) => s.chrome)
  const widgets = useDashboardStore((s) => s.widgets)
  const setRibbonHeight = useDashboardStore((s) => s.setRibbonHeight)
  const enableRibbon = useDashboardStore((s) => s.enableRibbon)
  const removeChromeItem = useDashboardStore((s) => s.removeChromeItem)

  const items = useMemo(() => chrome.ribbon.items.map((id) => widgets[id]).filter(Boolean), [chrome.ribbon.items, widgets])

  if (!chrome.ribbon.enabled) return null

  return (
    <Paper
      withBorder
      px="sm"
      py="xs"
      style={{
        height: chrome.ribbon.height,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        overflowX: 'auto',
        overflowY: 'hidden',
      }}
    >
      <Group justify="space-between" style={{ width: '100%' }} wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          <Text fw={700} size="sm">
            Ribbon
          </Text>

          {items.map((w) => (
            <Paper key={w!.id} withBorder p="xs" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ minWidth: 220 }}>
                {w!.type === 'kpi' ? (
                  <KpiWidget id={w!.id} compact />
                ) : w!.type === 'filterPane' ? (
                  <FilterPaneWidget id={w!.id} compact />
                ) : w!.type === 'button' ? (
                  <ButtonWidget id={w!.id} compact />
                ) : null}
              </div>
              {interactive ? (
                <Tooltip label="Remove from ribbon">
                  <ActionIcon variant="subtle" color="red" onClick={() => removeChromeItem(w!.id)} aria-label="Remove">
                    <IconX size={16} />
                  </ActionIcon>
                </Tooltip>
              ) : null}
            </Paper>
          ))}
        </Group>

        {interactive ? (
          <Group gap="xs" wrap="nowrap">
            <Tooltip label="Ribbon height">
              <ActionIcon variant="light" onClick={() => setRibbonHeight(chrome.ribbon.height - 8)} aria-label="Decrease ribbon height">
                -
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Ribbon height">
              <ActionIcon variant="light" onClick={() => setRibbonHeight(chrome.ribbon.height + 8)} aria-label="Increase ribbon height">
                +
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Disable ribbon">
              <ActionIcon variant="subtle" color="gray" onClick={() => enableRibbon(false)} aria-label="Disable ribbon">
                <IconX size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ) : null}
      </Group>
    </Paper>
  )
}

