import type { Category, Kind, Transaction } from '../types'

export type CsvPreviewRow = {
  externalId: string
  date: string
  amount: number
  kind: Kind
  merchant: string
  categoryHint: string
}

export type CsvParseResult = {
  rows: CsvPreviewRow[]
  detectedFormat: string
  positiveMeansExpense: boolean
}

export async function parseCsvStatement(text: string, positiveOverride?: boolean): Promise<CsvParseResult> {
  const records = parseCsv(text)
  if (records.length < 2) throw new Error('This CSV does not contain any transactions.')
  const headers = records[0].map(normalizeHeader)
  const values = records.slice(1).filter((row) => row.some((cell) => cell.trim()))
  const find = (...names: string[]) => headers.findIndex((header) => names.includes(header))
  const dateIndex = find('transaction date', 'date', 'trans date', 'posted date', 'post date')
  const merchantIndex = find('description', 'merchant', 'name', 'details')
  const amountIndex = find('amount', 'transaction amount')
  const debitIndex = find('debit', 'charge', 'charges')
  const creditIndex = find('credit', 'credits')
  const categoryIndex = find('category', 'category name')
  const typeIndex = find('type', 'transaction type')

  if (dateIndex < 0 || merchantIndex < 0 || (amountIndex < 0 && debitIndex < 0 && creditIndex < 0)) {
    throw new Error('Could not find date, description, and amount columns in this statement.')
  }

  const isCapitalOne = headers.includes('card no.') || (debitIndex >= 0 && creditIndex >= 0)
  const isAmex = headers.includes('card member') || headers.includes('account #')
  const isChase = headers.includes('memo') && typeIndex >= 0
  const detectedFormat = isCapitalOne ? 'Capital One' : isAmex ? 'American Express' : isChase ? 'Chase' : 'Generic CSV'
  const positiveMeansExpense = positiveOverride ?? !isChase
  const occurrences = new Map<string, number>()
  const rows: CsvPreviewRow[] = []

  for (const record of values) {
    const date = normalizeDate(record[dateIndex] ?? '')
    const merchant = (record[merchantIndex] ?? '').trim()
    if (!date || !merchant) continue
    const debit = debitIndex >= 0 ? parseCurrency(record[debitIndex] ?? '') : null
    const credit = creditIndex >= 0 ? parseCurrency(record[creditIndex] ?? '') : null
    const signedAmount = amountIndex >= 0 ? parseCurrency(record[amountIndex] ?? '') : null
    const type = typeIndex >= 0 ? (record[typeIndex] ?? '').toLowerCase() : ''
    let amount = 0
    let kind: Kind
    if (debit !== null && debit !== 0) {
      amount = Math.abs(debit)
      kind = 'expense'
    } else if (credit !== null && credit !== 0) {
      amount = Math.abs(credit)
      kind = 'income'
    } else if (signedAmount !== null && signedAmount !== 0) {
      amount = Math.abs(signedAmount)
      if (/payment|credit|return|refund|adjustment/.test(type)) kind = 'income'
      else if (/sale|purchase|charge|fee/.test(type)) kind = 'expense'
      else kind = signedAmount > 0 === positiveMeansExpense ? 'expense' : 'income'
    } else continue

    const base = `${date}|${amount.toFixed(2)}|${kind}|${merchant.toLowerCase().replace(/\s+/g, ' ')}`
    const occurrence = (occurrences.get(base) ?? 0) + 1
    occurrences.set(base, occurrence)
    rows.push({
      externalId: await sha256(`${base}|${occurrence}`),
      date,
      amount,
      kind,
      merchant,
      categoryHint: categoryIndex >= 0 ? (record[categoryIndex] ?? '').trim() : '',
    })
  }
  if (!rows.length) throw new Error('No valid transaction rows were found in this CSV.')
  return { rows, detectedFormat, positiveMeansExpense }
}
export function transactionsToCsv(rows: Transaction[], categories: Category[]): string {
  const byId = new Map(categories.map((c) => [c.id, c.name]))
  const header = ['date', 'kind', 'amount', 'name_or_merchant', 'category', 'notes']
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

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const input = text.replace(/^\uFEFF/, '')
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (char === '"') {
      if (quoted && input[index + 1] === '"') {
        cell += '"'
        index += 1
      } else quoted = !quoted
    } else if (char === ',' && !quoted) {
      row.push(cell)
      cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && input[index + 1] === '\n') index += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += char
  }
  if (cell.length || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function parseCurrency(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const negative = /^\(.*\)$/.test(trimmed)
  const parsed = Number(trimmed.replace(/[$,()\s]/g, ''))
  if (!Number.isFinite(parsed)) return null
  return negative ? -parsed : parsed
}

function normalizeDate(value: string): string | null {
  const trimmed = value.trim()
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(trimmed)
  if (!us) return null
  const year = us[3].length === 2 ? Number(us[3]) + (Number(us[3]) >= 70 ? 1900 : 2000) : Number(us[3])
  return `${year}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`
}

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
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
