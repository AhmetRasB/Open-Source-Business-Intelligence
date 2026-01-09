import type { ChartQueryRequest } from '../api/types'
import type { DashboardFilter } from '../stores/filterStore'
import type { Dataset } from '../stores/datasetsStore'

function toNumber(v: unknown) {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export function runDatasetChart(args: {
  dataset: Dataset
  dimension: string
  measures: string[]
  aggregation: ChartQueryRequest['aggregation']
  limit?: number
  activeFilter?: DashboardFilter | null
}): Record<string, unknown>[] {
  const { dataset, dimension, measures, aggregation, limit, activeFilter } = args
  const dim = dimension
  const ms = measures.length ? measures.slice(0, 6) : []

  // Apply dataset filter if matches this dataset + dimension/table scope.
  const filteredRows =
    activeFilter?.kind === 'dataset' && activeFilter.datasetId === dataset.id
      ? dataset.rows.filter((r) => activeFilter.values.includes(String((r as any)?.[activeFilter.column] ?? '')))
      : dataset.rows

  const groups = new Map<string, any[]>()
  for (const r of filteredRows) {
    const key = String((r as any)?.[dim] ?? '')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }

  const out: Record<string, unknown>[] = []
  for (const [key, rows] of groups) {
    const rowOut: Record<string, unknown> = { dimension: key }
    if (ms.length === 1) {
      // single-series uses backend convention: "value"
      rowOut.value = aggregate(rows, ms[0]!, aggregation)
    } else {
      for (const m of ms) rowOut[m] = aggregate(rows, m, aggregation)
    }
    out.push(rowOut)
  }

  // Sort descending by first measure
  out.sort((a, b) => {
    const ak = ms.length === 1 ? (a.value as any) : (a[ms[0]!] as any)
    const bk = ms.length === 1 ? (b.value as any) : (b[ms[0]!] as any)
    return Number(bk ?? 0) - Number(ak ?? 0)
  })

  const take = limit ? Math.max(1, Math.min(1000, limit)) : undefined
  return take ? out.slice(0, take) : out
}

function aggregate(rows: any[], column: string, agg: ChartQueryRequest['aggregation']) {
  if (agg === 'COUNT') return rows.length

  const nums = rows
    .map((r) => toNumber(r?.[column]))
    .filter((x): x is number => x !== null)

  if (nums.length === 0) return 0

  if (agg === 'SUM') return nums.reduce((a, b) => a + b, 0)
  if (agg === 'AVG') return nums.reduce((a, b) => a + b, 0) / nums.length
  if (agg === 'MIN') return Math.min(...nums)
  if (agg === 'MAX') return Math.max(...nums)
  return 0
}

