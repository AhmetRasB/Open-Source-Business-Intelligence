import type { ChartQueryRequest } from '../api/types'
import type { DashboardFilter } from '../stores/filterStore'
import type { Dataset } from '../stores/datasetsStore'

function toNumber(v: unknown) {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export function runDatasetKpi(args: {
  dataset: Dataset
  measure: string | '*'
  aggregation: ChartQueryRequest['aggregation']
  activeFilter?: DashboardFilter | null
}): number {
  const { dataset, measure, aggregation, activeFilter } = args

  const filteredRows =
    activeFilter?.kind === 'dataset' && activeFilter.datasetId === dataset.id
      ? dataset.rows.filter((r) => activeFilter.values.includes(String((r as any)?.[activeFilter.column] ?? '')))
      : dataset.rows

  if (aggregation === 'COUNT') return filteredRows.length

  const col = measure === '*' ? '' : measure
  const nums = filteredRows.map((r) => toNumber((r as any)?.[col])).filter((x): x is number => x !== null)
  if (nums.length === 0) return 0
  if (aggregation === 'SUM') return nums.reduce((a, b) => a + b, 0)
  if (aggregation === 'AVG') return nums.reduce((a, b) => a + b, 0) / nums.length
  if (aggregation === 'MIN') return Math.min(...nums)
  if (aggregation === 'MAX') return Math.max(...nums)
  return 0
}

