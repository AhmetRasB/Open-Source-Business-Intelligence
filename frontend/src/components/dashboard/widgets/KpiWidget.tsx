import { useEffect, useMemo } from 'react'
import { Group, Loader, Text } from '@mantine/core'

import { api } from '../../../api/client'
import type { KpiQueryRequest, KpiQueryResponse } from '../../../api/types'
import { runDatasetKpi } from '../../../lib/datasetKpi'
import { useDashboardStore } from '../../../stores/dashboardStore'
import { useDatasetsStore } from '../../../stores/datasetsStore'
import { useFilterStore } from '../../../stores/filterStore'

export function KpiWidget({ id, compact = false }: { id: string; compact?: boolean }) {
  const widget = useDashboardStore((s) => s.widgets[id])
  const setWidgetData = useDashboardStore((s) => s.setWidgetData)
  const setWidgetStatus = useDashboardStore((s) => s.setWidgetStatus)
  const getDatasetById = useDatasetsStore((s) => s.getById)
  const activeFilter = useFilterStore((s) => s.active)

  const filterKey = useMemo(() => JSON.stringify(activeFilter ?? null), [activeFilter])

  useEffect(() => {
    if (!widget || widget.type !== 'kpi') return
    const agg = widget.config.aggregation ?? 'SUM'
    const measure = widget.config.measure ?? '*'

    ;(async () => {
      try {
        setWidgetStatus(id, 'loading')

        if (widget.config.dataSource === 'dataset' && widget.config.datasetId) {
          const ds = getDatasetById(widget.config.datasetId)
          if (!ds) throw new Error('Dataset not found.')
          const value = runDatasetKpi({ dataset: ds, measure, aggregation: agg, activeFilter })
          setWidgetData(id, [{ value }])
          setWidgetStatus(id, 'idle')
          return
        }

        if (!widget.config.connectionId || !widget.config.sourceTable) throw new Error('Set Connection and Table.')

        const filters =
          activeFilter?.kind === 'db' &&
          widget.config.connectionId === activeFilter.connectionId &&
          widget.config.sourceTable === activeFilter.sourceTable
            ? [{ column: activeFilter.column, values: activeFilter.values }]
            : undefined

        const req: KpiQueryRequest = {
          connectionId: widget.config.connectionId,
          sourceTable: widget.config.sourceTable,
          measure,
          aggregation: agg,
          filters,
        }
        const res = await api.post<KpiQueryResponse>('/query/kpi', req)
        setWidgetData(id, [{ value: res.data.value }])
        setWidgetStatus(id, 'idle')
      } catch (err: any) {
        setWidgetStatus(id, 'error', String(err?.response?.data?.message ?? err?.message ?? err))
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, widget?.config.dataSource, widget?.config.datasetId, widget?.config.connectionId, widget?.config.sourceTable, widget?.config.measure, widget?.config.aggregation, filterKey])

  if (!widget || widget.type !== 'kpi') return null

  const raw = (widget.data?.[0] as any)?.value
  const decimals = widget.config.kpiDecimals ?? 0
  const prefix = widget.config.kpiPrefix ?? ''
  const suffix = widget.config.kpiSuffix ?? ''

  const valueStr = formatValue(raw, decimals, prefix, suffix)

  return (
    <Group justify="space-between" wrap="nowrap">
      {!compact ? (
        <Text size="sm" c="dimmed">
          {widget.title}
        </Text>
      ) : null}

      {widget.status === 'loading' ? (
        <Loader size="sm" />
      ) : widget.status === 'error' ? (
        <Text size="sm" c="red">
          Error
        </Text>
      ) : (
        <Text fw={800} size={compact ? 'sm' : 'lg'}>
          {valueStr}
        </Text>
      )}
    </Group>
  )
}

function formatValue(raw: unknown, decimals: number, prefix: string, suffix: string) {
  const n = typeof raw === 'number' ? raw : raw == null ? null : Number(raw)
  if (n == null || !Number.isFinite(n)) return `${prefix}${String(raw ?? '')}${suffix}`.trim()
  const fixed = n.toLocaleString(undefined, { maximumFractionDigits: Math.max(0, Math.min(6, decimals)) })
  return `${prefix}${fixed}${suffix}`.trim()
}

