import type { CSSProperties } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { Button, Group, Stack, Text } from '@mantine/core'

import { useDashboardStore } from '../../stores/dashboardStore'

function DraggableChartTile2({
  id,
  label,
}: {
  id:
    | 'palette:bar'
    | 'palette:line'
    | 'palette:area'
    | 'palette:pie'
    | 'palette:ribbon'
    | 'palette:sidebar'
    | 'palette:kpi'
    | 'palette:filterPane'
    | 'palette:button'
  label: string
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })
  const style: CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.6 : 1,
    cursor: 'grab',
  }
  return (
    <Button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      variant="light"
      fullWidth
      style={style}
    >
      {label} (drag to canvas)
    </Button>
  )
}

export function Palette() {
  const addWidget = useDashboardStore((s) => s.addWidget)
  const enableRibbon = useDashboardStore((s) => s.enableRibbon)
  const enableSidebar = useDashboardStore((s) => s.enableSidebar)

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Quick add:
        </Text>
      </Group>

      <Button onClick={() => addWidget('bar')}>Add Bar Chart</Button>
      <Button variant="light" onClick={() => addWidget('line')}>
        Add Line Chart
      </Button>
      <Button variant="light" onClick={() => addWidget('area')}>
        Add Area Chart
      </Button>
      <Button variant="light" onClick={() => addWidget('pie')}>
        Add Pie Chart
      </Button>
      <Button variant="light" onClick={() => addWidget('kpi')}>
        Add KPI (canvas)
      </Button>
      <Button variant="light" onClick={() => addWidget('filterPane')}>
        Add Filter Pane (canvas)
      </Button>
      <Button variant="light" onClick={() => addWidget('button')}>
        Add Button (canvas)
      </Button>
      <Button variant="light" onClick={() => enableRibbon(true)}>
        Enable Ribbon (sticky top)
      </Button>
      <Button variant="light" onClick={() => enableSidebar(true)}>
        Enable Sidebar (filters/KPIs)
      </Button>
      <DraggableChartTile2 id="palette:bar" label="Bar Chart" />
      <DraggableChartTile2 id="palette:line" label="Line Chart" />
      <DraggableChartTile2 id="palette:area" label="Area Chart" />
      <DraggableChartTile2 id="palette:pie" label="Pie Chart" />
      <DraggableChartTile2 id="palette:ribbon" label="Ribbon" />
      <DraggableChartTile2 id="palette:sidebar" label="Sidebar" />
      <DraggableChartTile2 id="palette:kpi" label="KPI (drop to canvas/ribbon/sidebar)" />
      <DraggableChartTile2 id="palette:filterPane" label="Filter pane (drop to canvas/ribbon/sidebar)" />
      <DraggableChartTile2 id="palette:button" label="Button (drop to canvas/ribbon/sidebar)" />
    </Stack>
  )
}


