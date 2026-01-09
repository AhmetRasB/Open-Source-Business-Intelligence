import { useEffect, useMemo, useState } from 'react'
import {
  Accordion,
  Button,
  Divider,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'

import { api } from '../../api/client'
import type { ChartQueryRequest, ConnectionDto, ExecuteQueryResponse } from '../../api/types'
import { useDashboardStore } from '../../stores/dashboardStore'
import { useDatasetsStore } from '../../stores/datasetsStore'
import { createDefaultEChartsOverridesJson } from '../../lib/echartsTemplates'
import { mergeEChartsOption } from '../../lib/echartsMerge'
import { runDatasetChart } from '../../lib/datasetChart'
import { useFilterStore } from '../../stores/filterStore'

type TableDto = { name: string }
type ColumnDto = { name: string; dataType: string }

function safeParseJson(raw: string | undefined): { ok: true; value: any } | { ok: false } {
  if (!raw?.trim()) return { ok: true, value: {} }
  try {
    return { ok: true, value: JSON.parse(raw) }
  } catch {
    return { ok: false }
  }
}

function asStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

function asBool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined
}

function asNum(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

function asStrArr(v: unknown): string[] | undefined {
  return Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : undefined
}

export function PropertiesPanel() {
  const selectedWidgetId = useDashboardStore((s) => s.selectedWidgetId)
  const widget = useDashboardStore((s) => (s.selectedWidgetId ? s.widgets[s.selectedWidgetId] : undefined))
  const updateWidgetConfig = useDashboardStore((s) => s.updateWidgetConfig)
  const setWidgetTitle = useDashboardStore((s) => s.setWidgetTitle)
  const setWidgetData = useDashboardStore((s) => s.setWidgetData)
  const setWidgetStatus = useDashboardStore((s) => s.setWidgetStatus)
  const datasets = useDatasetsStore((s) => s.datasets)
  const getDatasetById = useDatasetsStore((s) => s.getById)
  const activeFilter = useFilterStore((s) => s.active)

  const [connections, setConnections] = useState<ConnectionDto[]>([])
  const [tables, setTables] = useState<TableDto[]>([])
  const [columns, setColumns] = useState<ColumnDto[]>([])
  const [jsonError, setJsonError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await api.get<ConnectionDto[]>('/connections')
        setConnections(res.data)
      } catch {
        // backend might not be running yet
      }
    })()
  }, [])

  useEffect(() => {
    if (!widget?.config.connectionId) {
      setTables([])
      return
    }
    ;(async () => {
      try {
        const res = await api.get<TableDto[]>('/schema/tables', {
          params: { connectionId: widget.config.connectionId },
        })
        setTables(res.data)
      } catch {
        setTables([])
      }
    })()
  }, [widget?.config.connectionId])

  useEffect(() => {
    if (!widget?.config.connectionId || !widget?.config.sourceTable) {
      setColumns([])
      return
    }
    ;(async () => {
      try {
        const res = await api.get<ColumnDto[]>('/schema/columns', {
          params: { connectionId: widget.config.connectionId, table: widget.config.sourceTable },
        })
        setColumns(res.data)
      } catch {
        setColumns([])
      }
    })()
  }, [widget?.config.connectionId, widget?.config.sourceTable])

  const connectionOptions = useMemo(
    () => connections.map((c) => ({ value: c.id, label: `${c.name} (${c.provider})` })),
    [connections],
  )

  const tableOptions = useMemo(
    () => tables.map((t) => ({ value: t.name, label: t.name })),
    [tables],
  )

  const columnOptions = useMemo(
    () => columns.map((c) => ({ value: c.name, label: `${c.name} (${c.dataType})` })),
    [columns],
  )

  // IMPORTANT: Hooks must run unconditionally. Parse overrides even when no widget selected.
  const overridesParsed = useMemo(
    () => safeParseJson(widget?.config.echartsOptionOverridesJson),
    [widget?.config.echartsOptionOverridesJson],
  )
  const overrides = overridesParsed.ok ? overridesParsed.value : null

  if (!selectedWidgetId || !widget) {
    return (
      <Stack gap="sm">
        <Text fw={700}>Properties</Text>
        <Text size="sm" c="dimmed">
          Select a widget on the canvas to edit.
        </Text>
      </Stack>
    )
  }
  const id = selectedWidgetId
  const widgetType = widget.type

  // Special widget types (Ribbon/Sidebar widgets)
  if (widgetType === 'kpi') {
    const dataset = widget.config.datasetId ? getDatasetById(widget.config.datasetId) : null
    const datasetColumnOptions = (dataset?.columns ?? []).map((c) => ({ value: c, label: c }))

    return (
      <Stack gap="sm">
        <Text fw={700}>Properties</Text>

        <TextInput
          label="Title"
          value={widget.title}
          onChange={(e) => setWidgetTitle(id, e.currentTarget.value)}
          placeholder="KPI title"
        />

        <Select
          label="Data source"
          data={[
            { value: 'db', label: 'Database (SQL connection)' },
            { value: 'dataset', label: 'Imported dataset' },
          ]}
          value={widget.config.dataSource ?? 'db'}
          onChange={(v) => {
            const next = (v as any) ?? 'db'
            if (next === 'dataset') {
              updateWidgetConfig(id, {
                dataSource: 'dataset',
                connectionId: undefined,
                sourceTable: undefined,
              })
            } else {
              updateWidgetConfig(id, {
                dataSource: 'db',
                datasetId: undefined,
              })
            }
          }}
        />

        {widget.config.dataSource === 'dataset' ? (
          <>
            <Select
              label="Dataset"
              data={datasets.map((d) => ({ value: d.id, label: `${d.name} (${d.rows.length} rows)` }))}
              value={widget.config.datasetId ?? null}
              onChange={(v) => updateWidgetConfig(id, { datasetId: v ?? undefined })}
              searchable
              placeholder="Pick imported dataset"
            />
            <Select
              label="Measure"
              data={[{ value: '*', label: '* (COUNT only)' }, ...datasetColumnOptions]}
              value={widget.config.measure ?? '*'}
              onChange={(v) => updateWidgetConfig(id, { measure: v ?? undefined })}
              searchable
              placeholder="Pick measure"
            />
          </>
        ) : (
          <>
            <Select
              label="Connection"
              data={connectionOptions}
              value={widget.config.connectionId ?? null}
              onChange={(v) => updateWidgetConfig(id, { connectionId: v ?? undefined, sourceTable: undefined })}
              searchable
              placeholder="Pick connection"
            />
            <Select
              label="Table"
              data={tableOptions}
              value={widget.config.sourceTable ?? null}
              onChange={(v) => updateWidgetConfig(id, { sourceTable: v ?? undefined })}
              searchable
              placeholder="Pick table"
            />
            <Select
              label="Measure"
              data={[{ value: '*', label: '* (COUNT only)' }, ...columnOptions]}
              value={widget.config.measure ?? '*'}
              onChange={(v) => updateWidgetConfig(id, { measure: v ?? undefined })}
              searchable
              placeholder="Pick measure"
            />
          </>
        )}

        <Select
          label="Aggregation"
          data={['SUM', 'COUNT', 'AVG', 'MIN', 'MAX'].map((x) => ({ value: x, label: x }))}
          value={widget.config.aggregation ?? 'SUM'}
          onChange={(v) => updateWidgetConfig(id, { aggregation: (v as any) ?? 'SUM' })}
        />

        <Divider />

        <Group grow>
          <TextInput
            label="Prefix"
            value={widget.config.kpiPrefix ?? ''}
            onChange={(e) => updateWidgetConfig(id, { kpiPrefix: e.currentTarget.value })}
          />
          <TextInput
            label="Suffix"
            value={widget.config.kpiSuffix ?? ''}
            onChange={(e) => updateWidgetConfig(id, { kpiSuffix: e.currentTarget.value })}
          />
        </Group>
        <NumberInput
          label="Decimals"
          value={widget.config.kpiDecimals ?? 0}
          onChange={(v) => updateWidgetConfig(id, { kpiDecimals: typeof v === 'number' ? v : 0 })}
          min={0}
          max={6}
        />
      </Stack>
    )
  }

  if (widgetType === 'filterPane') {
    const dataset = widget.config.datasetId ? getDatasetById(widget.config.datasetId) : null
    const datasetColumnOptions = (dataset?.columns ?? []).map((c) => ({ value: c, label: c }))

    return (
      <Stack gap="sm">
        <Text fw={700}>Properties</Text>

        <TextInput
          label="Title"
          value={widget.title}
          onChange={(e) => setWidgetTitle(id, e.currentTarget.value)}
          placeholder="Filter title"
        />

        <Select
          label="Data source"
          data={[
            { value: 'db', label: 'Database (SQL connection)' },
            { value: 'dataset', label: 'Imported dataset' },
          ]}
          value={widget.config.dataSource ?? 'db'}
          onChange={(v) => {
            const next = (v as any) ?? 'db'
            if (next === 'dataset') {
              updateWidgetConfig(id, {
                dataSource: 'dataset',
                connectionId: undefined,
                sourceTable: undefined,
              })
            } else {
              updateWidgetConfig(id, {
                dataSource: 'db',
                datasetId: undefined,
              })
            }
          }}
        />

        {widget.config.dataSource === 'dataset' ? (
          <>
            <Select
              label="Dataset"
              data={datasets.map((d) => ({ value: d.id, label: `${d.name} (${d.rows.length} rows)` }))}
              value={widget.config.datasetId ?? null}
              onChange={(v) => updateWidgetConfig(id, { datasetId: v ?? undefined })}
              searchable
              placeholder="Pick imported dataset"
            />
            <Select
              label="Column (dimension)"
              data={datasetColumnOptions}
              value={widget.config.dimension ?? null}
              onChange={(v) => updateWidgetConfig(id, { dimension: v ?? undefined })}
              searchable
              placeholder="Pick column"
            />
          </>
        ) : (
          <>
            <Select
              label="Connection"
              data={connectionOptions}
              value={widget.config.connectionId ?? null}
              onChange={(v) => updateWidgetConfig(id, { connectionId: v ?? undefined, sourceTable: undefined })}
              searchable
              placeholder="Pick connection"
            />
            <Select
              label="Table"
              data={tableOptions}
              value={widget.config.sourceTable ?? null}
              onChange={(v) => updateWidgetConfig(id, { sourceTable: v ?? undefined })}
              searchable
              placeholder="Pick table"
            />
            <Select
              label="Column (dimension)"
              data={columnOptions}
              value={widget.config.dimension ?? null}
              onChange={(v) => updateWidgetConfig(id, { dimension: v ?? undefined })}
              searchable
              placeholder="Pick column"
            />
          </>
        )}

        <Switch
          label="Allow multi-select"
          checked={Boolean(widget.config.filterMulti)}
          onChange={(e) => updateWidgetConfig(id, { filterMulti: e.currentTarget.checked })}
        />
        <NumberInput
          label="Max values"
          value={widget.config.filterLimit ?? 80}
          onChange={(v) => updateWidgetConfig(id, { filterLimit: typeof v === 'number' ? v : 80 })}
          min={10}
          max={500}
        />
      </Stack>
    )
  }

  if (widgetType === 'button') {
    return (
      <Stack gap="sm">
        <Text fw={700}>Properties</Text>

        <TextInput
          label="Title"
          value={widget.title}
          onChange={(e) => setWidgetTitle(id, e.currentTarget.value)}
          placeholder="Button title"
        />

        <TextInput
          label="Label"
          value={widget.config.buttonLabel ?? ''}
          onChange={(e) => updateWidgetConfig(id, { buttonLabel: e.currentTarget.value })}
          placeholder="Button text"
        />

        <Group grow>
          <Select
            label="Variant"
            data={[
              { value: 'filled', label: 'Filled' },
              { value: 'light', label: 'Light' },
              { value: 'outline', label: 'Outline' },
              { value: 'default', label: 'Default' },
              { value: 'subtle', label: 'Subtle' },
            ]}
            value={widget.config.buttonVariant ?? 'filled'}
            onChange={(v) => updateWidgetConfig(id, { buttonVariant: (v as any) ?? 'filled' })}
          />
          <Select
            label="Size"
            data={[
              { value: 'xs', label: 'XS' },
              { value: 'sm', label: 'SM' },
              { value: 'md', label: 'MD' },
              { value: 'lg', label: 'LG' },
            ]}
            value={widget.config.buttonSize ?? 'sm'}
            onChange={(v) => updateWidgetConfig(id, { buttonSize: (v as any) ?? 'sm' })}
          />
        </Group>

        <TextInput
          label="Color"
          value={widget.config.buttonColor ?? 'blue'}
          onChange={(e) => updateWidgetConfig(id, { buttonColor: e.currentTarget.value })}
          placeholder="Mantine color (e.g. blue, red, teal, grape)"
        />

        <Select
          label="Action"
          data={[
            { value: 'none', label: 'None' },
            { value: 'clearFilters', label: 'Clear active filters' },
          ]}
          value={widget.config.buttonAction ?? 'none'}
          onChange={(v) => updateWidgetConfig(id, { buttonAction: (v as any) ?? 'none' })}
        />
      </Stack>
    )
  }

  // From here on, we only support chart widgets in the Properties panel.
  if (widgetType !== 'bar' && widgetType !== 'line' && widgetType !== 'area' && widgetType !== 'pie') {
    return (
      <Stack gap="sm">
        <Text fw={700}>Properties</Text>
        <Text size="sm" c="dimmed">
          Unsupported widget type: {String(widgetType)}
        </Text>
      </Stack>
    )
  }
  const chartType = widgetType as ChartQueryRequest['chartType']

  function applyOverridesPatch(patch: Record<string, unknown>) {
    // If JSON was invalid, overwrite from scratch (better UX than silently failing).
    const current = overridesParsed.ok ? overridesParsed.value : {}
    const next = mergeEChartsOption(current, patch)
    const pretty = JSON.stringify(next, null, 2)
    updateWidgetConfig(id, { echartsOptionOverridesJson: pretty })
    setJsonError(null)
  }

  async function preview() {
    // local alias for TS narrowing
    const w = useDashboardStore.getState().widgets[id]
    if (!w) return

    const measures = w.config.measures?.length ? w.config.measures : w.config.measure ? [w.config.measure] : []
    if (!w.config.dimension || measures.length === 0) {
      notifications.show({
        color: 'yellow',
        title: 'Missing fields',
        message: 'Please set Dimension, Measure(s).',
      })
      return
    }

    try {
      setWidgetStatus(id, 'loading')
      if (w.config.dataSource === 'dataset' && w.config.datasetId) {
        const ds = getDatasetById(w.config.datasetId)
        if (!ds) throw new Error('Dataset not found.')
        const rows = runDatasetChart({
          dataset: ds,
          dimension: w.config.dimension,
          measures,
          aggregation: w.config.aggregation ?? 'SUM',
          limit: 50,
          activeFilter,
        })
        setWidgetData(id, rows)
      } else {
        if (!w.config.connectionId || !w.config.sourceTable) {
          throw new Error('Please set Connection and Table.')
        }
        const req: ChartQueryRequest = {
          connectionId: w.config.connectionId,
          chartType,
          sourceTable: w.config.sourceTable,
          dimension: w.config.dimension,
          measure: measures[0]!,
          measures: measures.length > 1 ? measures : undefined,
          aggregation: w.config.aggregation ?? 'SUM',
          limit: 50,
        }
        const res = await api.post<ExecuteQueryResponse>('/query/chart', req)
        setWidgetData(id, res.data.rows)
      }
      setWidgetStatus(id, 'idle')
    } catch (err: any) {
      setWidgetStatus(id, 'error', String(err?.message ?? err))
      notifications.show({
        color: 'red',
        title: 'Query failed',
        message: String(err?.message ?? err),
      })
    }
  }

  return (
    <Stack gap="sm">
      <Text fw={700}>Properties</Text>

      <TextInput
        label="Title"
        value={widget.title}
        onChange={(e) => setWidgetTitle(id, e.currentTarget.value)}
        placeholder="Chart title"
      />

      <Group justify="flex-end">
        <Button onClick={preview} loading={widget.status === 'loading'}>
          Preview data
        </Button>
      </Group>

      <Divider />

      <Select
        label="Data source"
        data={[
          { value: 'db', label: 'Database (SQL connection)' },
          { value: 'dataset', label: 'Imported dataset' },
        ]}
        value={widget.config.dataSource ?? 'db'}
        onChange={(v) => {
          const next = (v as any) ?? 'db'
          if (next === 'dataset') {
            updateWidgetConfig(id, {
              dataSource: 'dataset',
              connectionId: undefined,
              sourceTable: undefined,
            })
          } else {
            updateWidgetConfig(id, {
              dataSource: 'db',
              datasetId: undefined,
            })
          }
        }}
      />

      {widget.config.dataSource === 'dataset' ? (
        <>
          <Select
            label="Dataset"
            data={datasets.map((d) => ({ value: d.id, label: `${d.name} (${d.rows.length} rows)` }))}
            value={widget.config.datasetId ?? null}
            onChange={(v) => {
              const ds = v ? getDatasetById(v) : undefined
              updateWidgetConfig(id, {
                datasetId: v ?? undefined,
                // reset fields to avoid mismatch
                dimension: ds?.columns?.[0],
                measures: ds?.columns?.slice(1, 2),
                measure: ds?.columns?.slice(1, 2)?.[0],
              })
            }}
            placeholder="Pick an imported dataset"
            searchable
          />
        </>
      ) : null}

      <Divider />

      <Select
        label="Connection"
        data={connectionOptions}
        value={widget.config.connectionId ?? null}
        onChange={(v) => updateWidgetConfig(id, { connectionId: v ?? undefined, sourceTable: undefined })}
        searchable
        placeholder="Pick a connection"
        disabled={(widget.config.dataSource ?? 'db') !== 'db'}
      />

      <Select
        label="Table"
        data={tableOptions}
        value={widget.config.sourceTable ?? null}
        onChange={(v) => updateWidgetConfig(id, { sourceTable: v ?? undefined })}
        searchable
        placeholder="Pick a table"
        disabled={(widget.config.dataSource ?? 'db') !== 'db' || !widget.config.connectionId}
      />

      <Group grow>
        <Select
          label="Dimension (X)"
          data={
            widget.config.dataSource === 'dataset'
              ? (getDatasetById(widget.config.datasetId ?? '')?.columns ?? []).map((c) => ({ value: c, label: c }))
              : columnOptions
          }
          value={widget.config.dimension ?? null}
          onChange={(v) => updateWidgetConfig(id, { dimension: v ?? undefined })}
          searchable
          placeholder="Column"
          disabled={
            widget.config.dataSource === 'dataset'
              ? !widget.config.datasetId
              : !widget.config.sourceTable
          }
        />
        <MultiSelect
          label="Measures (Y) (multi-series)"
          data={
            widget.config.dataSource === 'dataset'
              ? (getDatasetById(widget.config.datasetId ?? '')?.columns ?? []).map((c) => ({ value: c, label: c }))
              : columnOptions
          }
          value={widget.config.measures ?? (widget.config.measure ? [widget.config.measure] : [])}
          onChange={(vals) =>
            updateWidgetConfig(id, {
              measures: vals.length ? vals : undefined,
              measure: vals[0] ?? widget.config.measure,
            })
          }
          searchable
          placeholder="Select one or more columns"
          disabled={
            widget.config.dataSource === 'dataset'
              ? !widget.config.datasetId
              : !widget.config.sourceTable
          }
        />
      </Group>

      <Select
        label="Aggregation"
        data={[
          { value: 'SUM', label: 'SUM' },
          { value: 'COUNT', label: 'COUNT' },
          { value: 'AVG', label: 'AVG' },
          { value: 'MIN', label: 'MIN' },
          { value: 'MAX', label: 'MAX' },
        ]}
        value={widget.config.aggregation ?? 'SUM'}
        onChange={(v) =>
          updateWidgetConfig(id, {
            aggregation: (v as any) ?? 'SUM',
          })
        }
      />

      <Divider />

      <Accordion variant="separated" radius="md" defaultValue="echarts-inputs">
        <Accordion.Item value="style-quick">
          <Accordion.Control>Style (quick)</Accordion.Control>
          <Accordion.Panel>
            <Group grow>
              <Switch
                label="Tooltip"
                checked={widget.config.showTooltip ?? true}
                onChange={(e) => updateWidgetConfig(id, { showTooltip: e.currentTarget.checked })}
              />
              <Switch
                label="Grid"
                checked={widget.config.showGrid ?? true}
                onChange={(e) => updateWidgetConfig(id, { showGrid: e.currentTarget.checked })}
              />
              <Switch
                label="Smooth"
                checked={widget.config.smooth ?? true}
                onChange={(e) => updateWidgetConfig(id, { smooth: e.currentTarget.checked })}
              />
            </Group>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="echarts-inputs">
          <Accordion.Control>ECharts (common options)</Accordion.Control>
          <Accordion.Panel>
            {!overrides ? (
              <Text size="sm" c="red">
                Your overrides JSON is invalid. Fix it in Advanced, or click “Reset template”.
              </Text>
            ) : (
              <Stack gap="sm">
                {/* Series (per chart type) */}
                <Text fw={700} size="sm">
                  Series
                </Text>

                {widgetType === 'bar' ? (
                  <Stack gap="sm">
                    <Group grow>
                      <Switch
                        label="Stacked"
                        checked={Boolean(asStr(overrides?.series?.[0]?.stack))}
                        onChange={(e) =>
                          applyOverridesPatch({ series: [{ stack: e.currentTarget.checked ? 'total' : undefined }] })
                        }
                      />
                      <NumberInput
                        label="Bar width"
                        value={asNum(overrides?.series?.[0]?.barWidth) ?? undefined}
                        onChange={(v) =>
                          applyOverridesPatch({ series: [{ barWidth: typeof v === 'number' ? v : undefined }] })
                        }
                        min={1}
                        max={200}
                      />
                    </Group>
                    <Switch
                      label="Show value labels"
                      checked={asBool(overrides?.series?.[0]?.label?.show) ?? false}
                      onChange={(e) => applyOverridesPatch({ series: [{ label: { show: e.currentTarget.checked } }] })}
                    />
                    <Divider />
                  </Stack>
                ) : null}

                {widgetType === 'line' || widgetType === 'area' ? (
                  <Stack gap="sm">
                    <Group grow>
                      <NumberInput
                        label="Line width"
                        value={asNum(overrides?.series?.[0]?.lineStyle?.width) ?? 2}
                        onChange={(v) =>
                          applyOverridesPatch({ series: [{ lineStyle: { width: typeof v === 'number' ? v : 2 } }] })
                        }
                        min={1}
                        max={16}
                      />
                      <NumberInput
                        label="Symbol size"
                        value={asNum(overrides?.series?.[0]?.symbolSize) ?? 6}
                        onChange={(v) =>
                          applyOverridesPatch({ series: [{ symbolSize: typeof v === 'number' ? v : 6 }] })
                        }
                        min={0}
                        max={24}
                      />
                    </Group>
                    <Group grow>
                      <Switch
                        label="Show symbols"
                        checked={(asStr(overrides?.series?.[0]?.symbol) ?? 'circle') !== 'none'}
                        onChange={(e) => applyOverridesPatch({ series: [{ symbol: e.currentTarget.checked ? 'circle' : 'none' }] })}
                      />
                      <Switch
                        label="Area fill"
                        checked={Boolean(overrides?.series?.[0]?.areaStyle) || widgetType === 'area'}
                        onChange={(e) => applyOverridesPatch({ series: [{ areaStyle: e.currentTarget.checked ? {} : undefined }] })}
                      />
                    </Group>
                    <Divider />
                  </Stack>
                ) : null}

                {widgetType === 'pie' ? (
                  <Stack gap="sm">
                    <Group grow>
                      <TextInput
                        label="Radius (inner, outer)"
                        value={(asStrArr(overrides?.series?.[0]?.radius) ?? ['35%', '70%']).join(', ')}
                        onChange={(e) => {
                          const parts = e.currentTarget.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean)
                          const next =
                            parts.length >= 2 ? [parts[0]!, parts[1]!] : parts.length === 1 ? [parts[0]!] : undefined
                          applyOverridesPatch({ series: [{ radius: next }] })
                        }}
                        placeholder="e.g. 35%, 70%"
                      />
                      <Select
                        label="Rose type"
                        data={[
                          { value: 'none', label: 'None' },
                          { value: 'radius', label: 'Radius' },
                          { value: 'area', label: 'Area' },
                        ]}
                        value={asStr(overrides?.series?.[0]?.roseType) ?? 'none'}
                        onChange={(v) => applyOverridesPatch({ series: [{ roseType: v === 'none' ? undefined : v }] })}
                      />
                    </Group>
                    <Switch
                      label="Show labels"
                      checked={asBool(overrides?.series?.[0]?.label?.show) ?? true}
                      onChange={(e) => applyOverridesPatch({ series: [{ label: { show: e.currentTarget.checked } }] })}
                    />
                    <Divider />
                  </Stack>
                ) : null}

                {/* Title */}
                <Text fw={700} size="sm">
                  Title
                </Text>
                <Group grow>
                  <Switch
                    label="Show title"
                    checked={asBool(overrides?.title?.show) ?? Boolean(asStr(overrides?.title?.text))}
                    onChange={(e) => applyOverridesPatch({ title: { show: e.currentTarget.checked } })}
                  />
                  <Select
                    label="Align"
                    data={[
                      { value: 'left', label: 'Left' },
                      { value: 'center', label: 'Center' },
                      { value: 'right', label: 'Right' },
                    ]}
                    value={asStr(overrides?.title?.left) ?? 'left'}
                    onChange={(v) => applyOverridesPatch({ title: { left: v ?? 'left' } })}
                  />
                </Group>
                <TextInput
                  label="Title text"
                  value={asStr(overrides?.title?.text) ?? ''}
                  onChange={(e) => applyOverridesPatch({ title: { text: e.currentTarget.value } })}
                  placeholder="e.g. Sales by City"
                />
                <TextInput
                  label="Subtitle"
                  value={asStr(overrides?.title?.subtext) ?? ''}
                  onChange={(e) => applyOverridesPatch({ title: { subtext: e.currentTarget.value } })}
                  placeholder="Optional"
                />

                <Divider />

                {/* Legend / Toolbox / Zoom */}
                <Text fw={700} size="sm">
                  Navigation
                </Text>
                <Group grow>
                  <Switch
                    label="Legend"
                    checked={asBool(overrides?.legend?.show) ?? false}
                    onChange={(e) => applyOverridesPatch({ legend: { show: e.currentTarget.checked } })}
                  />
                  <Select
                    label="Legend position"
                    data={[
                      { value: 'top', label: 'Top' },
                      { value: 'bottom', label: 'Bottom' },
                      { value: 'left', label: 'Left' },
                      { value: 'right', label: 'Right' },
                    ]}
                    value={asStr(overrides?.legend?.top) ? 'top' : asStr(overrides?.legend?.bottom) ? 'bottom' : asStr(overrides?.legend?.left) ? 'left' : asStr(overrides?.legend?.right) ? 'right' : 'top'}
                    onChange={(v) => {
                      const pos = v ?? 'top'
                      const patch =
                        pos === 'top'
                          ? { legend: { top: 0, bottom: undefined, left: 'center', right: undefined } }
                          : pos === 'bottom'
                            ? { legend: { bottom: 0, top: undefined, left: 'center', right: undefined } }
                            : pos === 'left'
                              ? { legend: { left: 0, top: 'middle', bottom: undefined, right: undefined, orient: 'vertical' } }
                              : { legend: { right: 0, top: 'middle', bottom: undefined, left: undefined, orient: 'vertical' } }
                      applyOverridesPatch(patch as any)
                    }}
                  />
                </Group>

                <Group grow>
                  <Switch
                    label="Toolbox"
                    checked={asBool(overrides?.toolbox?.show) ?? false}
                    onChange={(e) =>
                      applyOverridesPatch({
                        toolbox: e.currentTarget.checked
                          ? { show: true, feature: { saveAsImage: {} } }
                          : { show: false },
                      })
                    }
                  />
                  <Switch
                    label="Data zoom"
                    checked={Array.isArray(overrides?.dataZoom) ? overrides.dataZoom.length > 0 : false}
                    onChange={(e) =>
                      applyOverridesPatch({
                        dataZoom: e.currentTarget.checked ? [{ type: 'inside' }, { type: 'slider' }] : [],
                      })
                    }
                  />
                </Group>

                <Divider />

                {/* Axes */}
                <Text fw={700} size="sm">
                  Axes
                </Text>
                <Group grow>
                  <TextInput
                    label="X axis name"
                    value={asStr(overrides?.xAxis?.name) ?? ''}
                    onChange={(e) => applyOverridesPatch({ xAxis: { name: e.currentTarget.value } })}
                    placeholder="Optional"
                  />
                  <TextInput
                    label="Y axis name"
                    value={asStr(overrides?.yAxis?.name) ?? ''}
                    onChange={(e) => applyOverridesPatch({ yAxis: { name: e.currentTarget.value } })}
                    placeholder="Optional"
                  />
                </Group>
                <Group grow>
                  <NumberInput
                    label="X label rotate"
                    value={asNum(overrides?.xAxis?.axisLabel?.rotate) ?? 0}
                    onChange={(v) => applyOverridesPatch({ xAxis: { axisLabel: { rotate: Number(v ?? 0) } } })}
                    min={-90}
                    max={90}
                    step={5}
                  />
                  <NumberInput
                    label="Y min (optional)"
                    value={asNum(overrides?.yAxis?.min) ?? undefined}
                    onChange={(v) => applyOverridesPatch({ yAxis: { min: v === '' || v === null ? undefined : Number(v) } })}
                    placeholder="auto"
                    hideControls={false}
                  />
                </Group>

                <Divider />

                {/* Layout / animation */}
                <Text fw={700} size="sm">
                  Layout
                </Text>
                <Group grow>
                  <TextInput
                    label="Background"
                    value={asStr(overrides?.backgroundColor) ?? ''}
                    onChange={(e) => applyOverridesPatch({ backgroundColor: e.currentTarget.value || 'transparent' })}
                    placeholder="transparent / #fff / rgba(...)"
                  />
                  <Switch
                    label="Animation"
                    checked={asBool(overrides?.animation) ?? true}
                    onChange={(e) => applyOverridesPatch({ animation: e.currentTarget.checked })}
                  />
                </Group>
                <Group grow>
                  <NumberInput
                    label="Animation duration (ms)"
                    value={asNum(overrides?.animationDuration) ?? 300}
                    onChange={(v) => applyOverridesPatch({ animationDuration: Number(v ?? 300) })}
                    min={0}
                    step={50}
                  />
                  <NumberInput
                    label="Grid bottom (px)"
                    value={asNum(overrides?.grid?.bottom) ?? 32}
                    onChange={(v) => applyOverridesPatch({ grid: { bottom: Number(v ?? 32) } })}
                    min={0}
                    step={2}
                  />
                </Group>
              </Stack>
            )}
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="echarts-advanced">
          <Accordion.Control>Advanced (JSON)</Accordion.Control>
          <Accordion.Panel>
            <Text size="sm" c="dimmed">
              Power-user mode. If you know ECharts, you can override any option here.
            </Text>
            <Textarea
              label="ECharts option overrides (JSON)"
              value={widget.config.echartsOptionOverridesJson ?? ''}
              onChange={(e) => {
                const v = e.currentTarget.value
                updateWidgetConfig(id, { echartsOptionOverridesJson: v || undefined })
                if (!v.trim()) {
                  setJsonError(null)
                  return
                }
                try {
                  JSON.parse(v)
                  setJsonError(null)
                } catch (err: any) {
                  setJsonError(String(err?.message ?? err))
                }
              }}
              minRows={8}
              autosize
              placeholder='{"legend":{"show":true},"toolbox":{"feature":{"saveAsImage":{}}}}'
            />
            {jsonError ? (
              <Text size="xs" c="red">
                Invalid JSON: {jsonError}
              </Text>
            ) : null}

            <Group justify="space-between" mt="sm">
              <Button
                variant="light"
                onClick={() =>
                  updateWidgetConfig(id, {
                    echartsOptionOverridesJson: createDefaultEChartsOverridesJson(chartType),
                  })
                }
              >
                Reset template
              </Button>
              <Button
                variant="light"
                onClick={() => {
                  const raw = widget.config.echartsOptionOverridesJson ?? ''
                  if (!raw.trim()) return
                  try {
                    const pretty = JSON.stringify(JSON.parse(raw), null, 2)
                    updateWidgetConfig(id, { echartsOptionOverridesJson: pretty })
                    setJsonError(null)
                  } catch (err: any) {
                    setJsonError(String(err?.message ?? err))
                  }
                }}
              >
                Format JSON
              </Button>
            </Group>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      {widget.status === 'error' && widget.error ? (
        <Text size="sm" c="red">
          {widget.error}
        </Text>
      ) : null}
    </Stack>
  )
}


