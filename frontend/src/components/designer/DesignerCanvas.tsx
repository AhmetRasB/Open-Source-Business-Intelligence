import { useRef } from 'react'
import { useDroppable } from '@dnd-kit/core'
import GridLayout, { getCompactor, useContainerWidth } from 'react-grid-layout'
import type { Layout, LayoutItem } from 'react-grid-layout'
import { Box } from '@mantine/core'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

import { useDashboardStore, type GridItem } from '../../stores/dashboardStore'
import { WidgetCard } from './WidgetCard'

export type GridSettings = {
  cols: number
  rowHeight: number
  margin: readonly [number, number]
  containerPadding: readonly [number, number]
}

export function DesignerCanvas({
  droppableId,
  gridSettings,
  interactive = true,
}: {
  droppableId: string
  gridSettings: GridSettings
  interactive?: boolean
}) {
  const { setNodeRef } = useDroppable({ id: droppableId })
  const { width, containerRef, mounted } = useContainerWidth()
  const containerNodeRef = useRef<HTMLDivElement | null>(null)
  const layout = useDashboardStore((s) => s.layout)
  const setLayout = useDashboardStore((s) => s.setLayout)
  const selectWidget = useDashboardStore((s) => s.selectWidget)

  return (
    <Box
      ref={(node) => {
        setNodeRef(node)
        ;(containerRef as any).current = node
        containerNodeRef.current = node
      }}
      h="100%"
      w="100%"
      p="xs"
      style={{ overflow: 'auto' }}
    >
      {mounted ? (
      <GridLayout
        layout={layout as unknown as Layout}
        width={width}
        gridConfig={{
          cols: gridSettings.cols,
          rowHeight: gridSettings.rowHeight,
          margin: gridSettings.margin,
          containerPadding: gridSettings.containerPadding,
          maxRows: Infinity,
        }}
        dragConfig={{
          enabled: interactive,
          // IMPORTANT: bounded dragging clamps to the visible container height,
          // which prevents moving items downward even if the canvas can scroll.
          // We rely on scroll + preventCollision instead.
          bounded: false,
          handle: '.widget-drag-handle',
        }}
        resizeConfig={{
          enabled: interactive,
        }}
        // Key behavior:
        // - allowOverlap=false so items can't stack
        // - preventCollision=true so dragging into an occupied space is blocked (no pushing others away)
        compactor={getCompactor(null, false, true)}
        onDrag={(_, __, ___, ____, ev) => {
          if (!interactive) return
          const node = containerNodeRef.current
          if (!node) return
          const e = ev as unknown as MouseEvent
          const rect = node.getBoundingClientRect()
          const edge = 60
          const step = 28
          if (e.clientY > rect.bottom - edge) node.scrollTop += step
          else if (e.clientY < rect.top + edge) node.scrollTop -= step
        }}
        onLayoutChange={(next: Layout) => {
          const normalized: GridItem[] = (next as readonly LayoutItem[]).map((i) => ({
            i: i.i,
            x: i.x,
            y: i.y,
            w: i.w,
            h: i.h,
          }))
          setLayout(normalized)
        }}
      >
        {layout.map((item) => (
          <div
            key={item.i}
            // Use capture because ECharts (and some internal handlers) may stop bubbling events.
            onMouseDownCapture={() => {
              if (!interactive) return
              selectWidget(item.i)
            }}
            style={{ height: '100%' }}
          >
            <WidgetCard id={item.i} interactive={interactive} />
          </div>
        ))}
      </GridLayout>
      ) : null}
    </Box>
  )
}


