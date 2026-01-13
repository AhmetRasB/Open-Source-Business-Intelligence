import { useEffect, useMemo, useState } from 'react'
import { Checkbox, Group, Loader, ScrollArea, Select, Stack, Text, TextInput } from '@mantine/core'

import { api } from '../../../api/client'
import type { DistinctValuesRequest, DistinctValuesResponse } from '../../../api/types'
import { getDatasetDistinctValues } from '../../../lib/datasetValues'
import { useDashboardStore } from '../../../stores/dashboardStore'
import { useDatasetsStore } from '../../../stores/datasetsStore'
import { useFilterStore } from '../../../stores/filterStore'

export function FilterPaneWidget({ id, compact = false }: { id: string; compact?: boolean }) {
  const widget = useDashboardStore((s) => s.widgets[id])
  const getDatasetById = useDatasetsStore((s) => s.getById)
  const activeFilter = useFilterStore((s) => s.active)
  const applyClick = useFilterStore((s) => s.applyClick)
  const clear = useFilterStore((s) => s.clear)

  const [search, setSearch] = useState('')
  const [values, setValues] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const filterKey = useMemo(() => JSON.stringify(activeFilter ?? null), [activeFilter])

  const column = widget?.config.dimension
  const multi = Boolean(widget?.config.filterMulti)
  const limit = widget?.config.filterLimit ?? 80

  useEffect(() => {
    if (!widget || widget.type !== 'filterPane') return
    if (!column) {
      setValues([])
      return
    }
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        if (widget.config.dataSource === 'dataset' && widget.config.datasetId) {
          const ds = getDatasetById(widget.config.datasetId)
          if (!ds) throw new Error('Dataset not found.')
          const vals = getDatasetDistinctValues({ dataset: ds, column, search, limit })
          if (!alive) return
          setValues(vals)
          return
        }

        if (!widget.config.connectionId || !widget.config.sourceTable) {
          if (!alive) return
          setValues([])
          return
        }

        // Optional: show values respecting the current active DB filter (same table)
        const filters =
          activeFilter?.kind === 'db' &&
          widget.config.connectionId === activeFilter.connectionId &&
          widget.config.sourceTable === activeFilter.sourceTable
            ? [{ column: activeFilter.column, values: activeFilter.values }]
            : undefined

        const req: DistinctValuesRequest = {
          connectionId: widget.config.connectionId,
          sourceTable: widget.config.sourceTable,
          column,
          search: search.trim() ? search.trim() : undefined,
          limit,
          filters,
        }
        const res = await api.post<DistinctValuesResponse>('/query/distinct', req)
        if (!alive) return
        setValues(res.data.values ?? [])
      } catch {
        if (!alive) return
        setValues([])
      } finally {
        if (!alive) return
        setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, widget?.config.dataSource, widget?.config.datasetId, widget?.config.connectionId, widget?.config.sourceTable, widget?.config.dimension, search, limit, filterKey])

  if (!widget || widget.type !== 'filterPane') return null

  const selected =
    activeFilter &&
    ((activeFilter.kind === 'dataset' && widget.config.dataSource === 'dataset' && activeFilter.datasetId === widget.config.datasetId) ||
      (activeFilter.kind === 'db' &&
        widget.config.dataSource !== 'dataset' &&
        activeFilter.connectionId === widget.config.connectionId &&
        activeFilter.sourceTable === widget.config.sourceTable)) &&
    activeFilter.column === column
      ? activeFilter.values
      : []

  const header = (
    <Group justify="space-between" wrap="nowrap">
      <Text size="sm" fw={600}>
        {widget.title}
      </Text>
      {selected.length > 0 ? (
        <Text size="xs" c="dimmed" style={{ cursor: 'pointer' }} onClick={clear}>
          Clear
        </Text>
      ) : null}
    </Group>
  )

  if (compact) {
    return (
      <Stack gap={6}>
        {header}
        <Select
          placeholder={column ? `Filter by ${column}` : 'Pick a column in Properties'}
          searchable
          data={values.map((v) => ({ value: v, label: v }))}
          value={selected[0] ?? null}
          onChange={(v) => {
            const value = String(v ?? '').trim()
            if (!value) return
            if (widget.config.dataSource === 'dataset' && widget.config.datasetId) {
              applyClick({ kind: 'dataset', datasetId: widget.config.datasetId, column: column ?? '', value, multi: false })
              return
            }
            applyClick({
              kind: 'db',
              connectionId: widget.config.connectionId ?? '',
              sourceTable: widget.config.sourceTable ?? '',
              column: column ?? '',
              value,
              multi: false,
            })
          }}
          rightSection={loading ? <Loader size="xs" /> : undefined}
        />
      </Stack>
    )
  }

  return (
    <Stack gap="xs">
      {header}
      <TextInput
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        placeholder={column ? `Search ${column}…` : 'Pick a column in Properties'}
      />

      <ScrollArea h={260} type="auto">
        <Stack gap={6} pr="xs">
          {loading ? (
            <Group gap="xs">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">
                Loading…
              </Text>
            </Group>
          ) : values.length === 0 ? (
            <Text size="sm" c="dimmed">
              {column ? 'No values.' : 'Pick a column in Properties.'}
            </Text>
          ) : (
            values.map((v) => (
              <Checkbox
                key={v}
                label={v}
                checked={selected.some((x) => x.toLowerCase() === v.toLowerCase())}
                onChange={() => {
                  if (!column) return
                  const value = v
                  const m = multi
                  if (widget.config.dataSource === 'dataset' && widget.config.datasetId) {
                    applyClick({ kind: 'dataset', datasetId: widget.config.datasetId, column, value, multi: m })
                    return
                  }
                  applyClick({
                    kind: 'db',
                    connectionId: widget.config.connectionId ?? '',
                    sourceTable: widget.config.sourceTable ?? '',
                    column,
                    value,
                    multi: m,
                  })
                }}
              />
            ))
          )}
        </Stack>
      </ScrollArea>
    </Stack>
  )
}

