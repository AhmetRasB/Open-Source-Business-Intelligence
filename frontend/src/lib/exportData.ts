export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const keys = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r ?? {}).forEach((k) => set.add(k))
      return set
    }, new Set<string>()),
  )

  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    const needsQuotes = /[",\n\r]/.test(s)
    const out = s.replace(/"/g, '""')
    return needsQuotes ? `"${out}"` : out
  }

  const lines = [
    keys.join(','),
    ...rows.map((r) => keys.map((k) => escape((r as any)?.[k])).join(',')),
  ]

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function downloadXlsx(filename: string, rows: Record<string, unknown>[]) {
  const { utils, write } = await import('xlsx')
  const ws = utils.json_to_sheet(rows)
  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, 'Data')
  const out = write(wb, { type: 'array', bookType: 'xlsx' })
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

