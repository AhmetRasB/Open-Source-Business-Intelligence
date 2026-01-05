export type DbProvider = 'postgres' | 'sqlServer'

export type ConnectionDto = {
  id: string
  name: string
  provider: DbProvider
}

export type CreateConnectionRequest = {
  name: string
  provider: DbProvider
  connectionString: string
}

export type TestConnectionRequest = {
  provider: DbProvider
  connectionString: string
}

export type ExecuteQueryRequest = {
  connectionId: string
  sql: string
}

export type ExecuteQueryResponse = {
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
}

export type AiChatResponse = {
  model: string
  content: string
}

export type ChartQueryRequest = {
  connectionId: string
  chartType: 'bar' | 'line' | 'area' | 'pie'
  sourceTable: string
  dimension: string
  measure: string
  measures?: string[]
  filters?: { column: string; values: string[] }[]
  aggregation: 'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX'
  limit?: number
}

export type DistinctValuesRequest = {
  connectionId: string
  sourceTable: string
  column: string
  search?: string
  limit?: number
  filters?: { column: string; values: string[] }[]
}

export type DistinctValuesResponse = {
  values: string[]
}

export type KpiQueryRequest = {
  connectionId: string
  sourceTable: string
  measure: string
  aggregation: 'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX'
  filters?: { column: string; values: string[] }[]
}

export type KpiQueryResponse = {
  value: number | string | null
}


