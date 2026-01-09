import { useEffect, useMemo, useState } from 'react'
import { ActionIcon, Badge, Divider, Group, Paper, Text } from '@mantine/core'
import { IconCopy, IconDownload, IconFileSpreadsheet, IconTrash } from '@tabler/icons-react'
import ReactECharts from 'echarts-for-react'

import { useDashboardStore } from '../../stores/dashboardStore'
import { mergeEChartsOption } from '../../lib/echartsMerge'
import { downloadCsv, downloadXlsx } from '../../lib/exportData'
import { useFilterStore } from '../../stores/filterStore'
import { KpiWidget } from '../dashboard/widgets/KpiWidget'
import { FilterPaneWidget } from '../dashboard/widgets/FilterPaneWidget'
import { ButtonWidget } from '../dashboard/widgets/ButtonWidget'

const fallbackData = [
  { dimension: 'A', value: 120 },
  { dimension: 'B', value: 98 },
  { dimension: 'C', value: 86 },
  { dimension: 'D', value: 132 },
]

export function WidgetCard({ id, interactive = true }: { id: string; interactive?: boolean }) {
  const widget = useDashboardStore((s) => s.widgets[id])
  const selectedId = useDashboardStore((s) => s.selectedWidgetId)
  const deleteWidget = useDashboardStore((s) => s.deleteWidget)
  const duplicateWidget = useDashboardStore((s) => s.duplicateWidget)
  const applyClickFilter = useFilterStore((s) => s.applyClick)

  const data = useMemo(() => {
    if (!widget) return fallbackData
    if (widget.data && widget.data.length > 0) return widget.data
    return fallbackData
  }, [widget])

  const isSelected = selectedId === id

  if (!widget) return null

  const isChart = widget.type === 'bar' || widget.type === 'line' || widget.type === 'area' || widget.type === 'pie'

  // Simple right-click context menu (positioned at cursor)
  const [ctx, setCtx] = useState<{ x: number; y: number } | null>(null)
  useEffect(() => {
    if (!ctx) return
    const onDown = () => setCtx(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCtx(null)
    }
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [ctx])

  const option = useMemo(() => {
    if (!isChart) return null
    const categories = (data as any[]).map((r) => String(r.dimension ?? ''))
    const palette = widget.config.palette?.length
      ? widget.config.palette
      : ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ef4444', '#06b6d4']

    const showGrid = widget.config.showGrid ?? true
    const showTooltip = widget.config.showTooltip ?? true
    const smooth = widget.config.smooth ?? true

    const seriesKeys =
      widget.config.measures?.length
        ? widget.config.measures
        : ['value'] // backend single-series default alias

    if (widget.type === 'pie') {
      const key = seriesKeys[0] ?? 'value'
      const values = (data as any[]).map((r) => Number(r[key] ?? r.value ?? 0))
      const basePie: any = {
        tooltip: showTooltip ? { trigger: 'item' } : undefined,
        color: palette,
        series: [
          {
            type: 'pie',
            radius: ['35%', '70%'],
            avoidLabelOverlap: true,
            itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
            label: { show: true, formatter: '{b}: {c}' },
            data: categories.map((name, idx) => ({ name, value: values[idx] })),
          },
        ],
      }

      // Advanced: merge user-provided ECharts option overrides (A-to-Z).
      if (widget.config.echartsOptionOverridesJson?.trim()) {
        try {
          const overrides = JSON.parse(widget.config.echartsOptionOverridesJson)
          return mergeEChartsOption(basePie, overrides)
        } catch {
          // ignore invalid JSON, keep base chart
          return basePie
        }
      }

      return basePie
    }

    const seriesType =
      widget.type === 'line' ? 'line' : widget.type === 'area' ? 'line' : 'bar'

    const series = seriesKeys.map((k) => ({
      name: k,
      type: seriesType,
      data: (data as any[]).map((r) => Number(r[k] ?? 0)),
      smooth,
      areaStyle: widget.type === 'area' ? {} : undefined,
    }))

    const base: any = {
      color: palette,
      tooltip: showTooltip ? { trigger: 'axis' } : undefined,
      grid: { left: 40, right: 16, top: 16, bottom: 32 },
      xAxis: { type: 'category', data: categories },
      yAxis: { type: 'value' },
      series,
    }

    if (showGrid) {
      base.xAxis.axisLine = { show: true }
      base.yAxis.axisLine = { show: true }
      base.xAxis.splitLine = { show: false }
      base.yAxis.splitLine = { show: true }
    } else {
      base.xAxis.axisLine = { show: false }
      base.yAxis.axisLine = { show: false }
      base.yAxis.splitLine = { show: false }
    }

    // Advanced: merge user-provided ECharts option overrides (A-to-Z).
    if (widget.config.echartsOptionOverridesJson?.trim()) {
      try {
        const overrides = JSON.parse(widget.config.echartsOptionOverridesJson)
        return mergeEChartsOption(base, overrides)
      } catch {
        // ignore invalid JSON, keep base chart
        return base
      }
    }

    return base
  }, [data, isChart, widget.type, widget.config])

  return (
    <Paper
      withBorder
      p="sm"
      h="100%"
      style={{
        borderColor: isSelected ? 'var(--mantine-color-blue-6)' : undefined,
        borderWidth: isSelected ? 2 : 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      onContextMenu={(e) => {
        if (!interactive) return
        e.preventDefault()
        setCtx({ x: e.clientX, y: e.clientY })
      }}
    >
      <Group justify="space-between" gap="xs" mb="xs" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          {interactive ? (
            <ActionIcon variant="subtle" className="widget-drag-handle" aria-label="Drag widget">
              ::
            </ActionIcon>
          ) : null}
          <Text fw={700} size="sm" lineClamp={1}>
            {widget.title}
          </Text>
        </Group>
        <Group gap="xs" wrap="nowrap">
          <Badge size="xs" variant="light">
            {widget.type}
          </Badge>
          {interactive ? (
            <ActionIcon
              variant="subtle"
              color="red"
              aria-label="Delete widget"
              onClick={(e) => {
                e.stopPropagation()
                if (confirm('Delete this widget?')) deleteWidget(id)
              }}
            >
              <IconTrash size={16} />
            </ActionIcon>
          ) : null}
        </Group>
      </Group>

      {ctx ? (
        <div
          style={{
            position: 'fixed',
            left: ctx.x,
            top: ctx.y,
            zIndex: 6000,
          }}
          onMouseDownCapture={(e) => e.stopPropagation()}
        >
          <Paper withBorder shadow="md" p="xs" radius="md" style={{ width: 220 }}>
            <div
              className="flex items-center gap-2 px-2 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
              onClick={() => {
                duplicateWidget(id)
                setCtx(null)
              }}
            >
              <IconCopy size={16} />
              <Text size="sm">Duplicate</Text>
            </div>
            <div
              className="flex items-center gap-2 px-2 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
              onClick={async () => {
                downloadCsv(widget.title || 'chart-data', (widget.data as any[]) ?? [])
                setCtx(null)
              }}
            >
              <IconDownload size={16} />
              <Text size="sm">Export CSV</Text>
            </div>
            <div
              className="flex items-center gap-2 px-2 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
              onClick={async () => {
                await downloadXlsx(widget.title || 'chart-data', (widget.data as any[]) ?? [])
                setCtx(null)
              }}
            >
              <IconFileSpreadsheet size={16} />
              <Text size="sm">Export Excel</Text>
            </div>
            <Divider my="xs" />
            <div
              className="flex items-center gap-2 px-2 py-2 rounded hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer text-red-600"
              onClick={() => {
                if (confirm('Delete this widget?')) deleteWidget(id)
                setCtx(null)
              }}
            >
              <IconTrash size={16} />
              <Text size="sm">Delete</Text>
            </div>
          </Paper>
        </div>
      ) : null}

      <div style={{ flex: 1, minHeight: 0 }}>
        {!isChart ? (
          widget.type === 'kpi' ? (
            <KpiWidget id={id} />
          ) : widget.type === 'filterPane' ? (
            <FilterPaneWidget id={id} />
          ) : widget.type === 'button' ? (
            <ButtonWidget id={id} />
          ) : (
            <Text size="sm" c="dimmed">
              Unsupported widget type: {String(widget.type)}
            </Text>
          )
        ) : (
          <ReactECharts
            option={option as any}
            style={{ width: '100%', height: '100%' }}
            opts={{ renderer: 'canvas' }}
            notMerge
            lazyUpdate
            onEvents={
              interactive
                ? {
                    click: (params: any) => {
                      const col = widget.config.dimension
                      const value = String(params?.name ?? '')
                      const native = (params?.event?.event ?? params?.event) as MouseEvent | undefined
                      const multi = Boolean((native as any)?.ctrlKey || (native as any)?.metaKey)
                      if (!col || !value) return

                      // Imported dataset widgets
                      if (widget.config.dataSource === 'dataset' && widget.config.datasetId) {
                        applyClickFilter({
                          kind: 'dataset',
                          datasetId: widget.config.datasetId,
                          column: col,
                          value,
                          multi,
                        })
                        return
                      }

                      // DB-backed widgets
                      if (widget.config.connectionId && widget.config.sourceTable) {
                        applyClickFilter({
                          kind: 'db',
                          connectionId: widget.config.connectionId,
                          sourceTable: widget.config.sourceTable,
                          column: col,
                          value,
                          multi,
                        } as any)
                      }
                    },
                  }
                : undefined
            }
          />
        )}
      </div>
    </Paper>
  )
}


