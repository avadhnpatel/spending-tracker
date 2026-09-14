import type { Category, Transaction } from '../types'
export function transactionsToCsv(rows: Transaction[], categories: Category[]): string {
  const byId = new Map(categories.map((c) => [c.id, c.name]))
  const header = ['date', 'kind', 'amount', 'merchant', 'category', 'notes']
  const lines = rows.map((t) =>
    [
      t.date,
      t.kind,
      t.amount.toFixed(2),
      csvCell(t.merchant),
      csvCell(t.category_id ? (byId.get(t.category_id) ?? '') : ''),
      csvCell(t.notes),
    ].join(','),
  )
  return [header.join(','), ...lines].join('\n')
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`
  return value
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
