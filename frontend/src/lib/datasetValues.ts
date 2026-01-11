import type { Dataset } from '../stores/datasetsStore'

export function getDatasetDistinctValues(args: {
  dataset: Dataset
  column: string
  search?: string
  limit?: number
}): string[] {
  const { dataset, column } = args
  const search = String(args.search ?? '').trim().toLowerCase()
  const limit = args.limit == null ? 100 : Math.max(1, Math.min(500, args.limit))

  const seen = new Map<string, number>()
  for (const r of dataset.rows) {
    const raw = (r as any)?.[column]
    const v = String(raw ?? '').trim()
    if (!v) continue
    if (search && !v.toLowerCase().includes(search)) continue
    seen.set(v, (seen.get(v) ?? 0) + 1)
  }

  // Sort by frequency desc, then alpha.
  return [...seen.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([v]) => v)
}

