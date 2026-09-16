import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTrackers } from '../context/TrackerContext'
import { parseCsvStatement, type CsvParseResult } from '../lib/csv'
import { formatDate, formatMoney } from '../lib/format'
import { connectPlaid, resumePlaidRedirect, syncPlaid } from '../lib/plaid'
import {
  commitImportCandidate,
  listCategories,
  listFinancialAccounts,
  listImportCandidates,
  stageCsvCandidates,
  updateImportCandidate,
} from '../lib/queries'
import type { Category, FinancialAccount, ImportCandidate, Tracker } from '../types'

type ReviewChoice = { included: boolean; categoryId: string | null }
type ReviewFilter = 'all' | 'included' | 'excluded'

export function ImportPage() {
  const { user } = useAuth()
  const { collections, trackers, activeCollection, createTracker } = useTrackers()
  const [candidates, setCandidates] = useState<ImportCandidate[]>([])
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [collectionId, setCollectionId] = useState(activeCollection?.id ?? '')
  const [customTrackerId, setCustomTrackerId] = useState('')
  const [choices, setChoices] = useState<Record<string, ReviewChoice>>({})
  const [csvText, setCsvText] = useState('')
  const [csvResult, setCsvResult] = useState<CsvParseResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all')
  const [confirmingImport, setConfirmingImport] = useState(false)

  const liveCollections = collections.filter((collection) => !collection.archived_at)
  const selectedCollection = liveCollections.find((collection) => collection.id === collectionId) ?? liveCollections[0] ?? null
  const collectionTrackers = trackers.filter((tracker) => tracker.collection_id === selectedCollection?.id && !tracker.archived_at)
  const categoryTracker = selectedCollection?.kind === 'custom'
    ? collectionTrackers.find((tracker) => tracker.id === customTrackerId) ?? collectionTrackers[0]
    : collectionTrackers[0]

  const refresh = useCallback(async () => {
    const [candidateRows, accountRows] = await Promise.all([listImportCandidates(), listFinancialAccounts()])
    setCandidates(candidateRows)
    setAccounts(accountRows)
  }, [])

  useEffect(() => {
    void refresh().catch((err) => setError(err instanceof Error ? err.message : 'Could not load imports'))
  }, [refresh])

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('oauth_state_id')) return
    setBusy(true)
    void resumePlaidRedirect()
      .then(async (resumed) => {
        if (!resumed) return
        const staged = await syncPlaid()
        setNotice(`Bank connected. ${staged} new transactions are ready to review.`)
        await refresh()
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not finish connecting the bank'))
      .finally(() => setBusy(false))
  }, [refresh])

  useEffect(() => {
    if (!collectionId && liveCollections[0]) setCollectionId(liveCollections[0].id)
  }, [collectionId, liveCollections])

  useEffect(() => {
    if (selectedCollection?.kind === 'custom' && collectionTrackers.length && !collectionTrackers.some((tracker) => tracker.id === customTrackerId)) {
      setCustomTrackerId(collectionTrackers[0].id)
    }
  }, [collectionTrackers, customTrackerId, selectedCollection])

  useEffect(() => {
    if (!categoryTracker || !selectedCollection) {
      setCategories([])
      return
    }
    void listCategories(categoryTracker.id, selectedCollection.id).then(setCategories, (err) => setError(err.message))
  }, [categoryTracker, selectedCollection])

  useEffect(() => {
    setChoices((current) => {
      const next = { ...current }
      for (const candidate of candidates) {
        if (next[candidate.id]) continue
        const hint = candidate.category_hint.toLowerCase().replaceAll('_', ' ')
        const category = categories.find((row) => row.kind === candidate.kind && (
          hint.includes(row.name.toLowerCase()) || row.name.toLowerCase().includes(hint)
        ))
        next[candidate.id] = { included: false, categoryId: category?.id ?? null }
      }
      return next
    })
  }, [candidates, categories])

  function destination(candidate: ImportCandidate): Tracker | null {
    if (!selectedCollection) return null
    if (selectedCollection.kind === 'custom') {
      return collectionTrackers.find((tracker) => tracker.id === customTrackerId) ?? null
    }
    return collectionTrackers.find((tracker) => (
      tracker.period_start && tracker.period_end &&
      candidate.date >= tracker.period_start && candidate.date <= tracker.period_end
    )) ?? null
  }

  async function chooseCsv(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      const text = await file.text()
      setCsvText(text)
      setCsvResult(await parseCsvStatement(text))
    } catch (err) {
      setCsvResult(null)
      setError(err instanceof Error ? err.message : 'Could not read this CSV')
    }
  }

  async function changeSignConvention(positiveMeansExpense: boolean) {
    if (!csvText) return
    setCsvResult(await parseCsvStatement(csvText, positiveMeansExpense))
  }

  async function stageCsv() {
    if (!user || !csvResult) return
    setBusy(true)
    setError(null)
    try {
      await stageCsvCandidates(csvResult.rows.map((row) => ({
        user_id: user.id,
        provider: 'csv' as const,
        external_id: row.externalId,
        account_id: null,
        account_name: `${csvResult.detectedFormat} CSV`,
        date: row.date,
        amount: row.amount,
        kind: row.kind,
        merchant: row.merchant,
        category_hint: row.categoryHint,
        pending: false,
      })))
      setNotice(`${csvResult.rows.length} rows checked. Existing duplicates were skipped.`)
      setCsvResult(null)
      setCsvText('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not stage CSV transactions')
    } finally {
      setBusy(false)
    }
  }

  async function connectBank() {
    setBusy(true)
    setError(null)
    try {
      await connectPlaid()
      const staged = await syncPlaid()
      setNotice(`Bank connected. ${staged} new transactions are ready to review.`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect bank')
    } finally {
      setBusy(false)
    }
  }

  async function syncBank() {
    setBusy(true)
    setError(null)
    try {
      const staged = await syncPlaid()
      setNotice(staged ? `${staged} new transactions are ready to review.` : 'Everything is up to date.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sync bank transactions')
    } finally {
      setBusy(false)
    }
  }

  async function importReviewed() {
    setConfirmingImport(false)
    setBusy(true)
    setError(null)
    let imported = 0
    try {
      for (const candidate of candidates) {
        const choice = choices[candidate.id] ?? { included: false, categoryId: null }
        if (!choice.included) {
          await updateImportCandidate(candidate.id, { status: 'excluded' })
          continue
        }
        const tracker = destination(candidate)
        if (!tracker) continue
        await commitImportCandidate({ candidate, trackerId: tracker.id, categoryId: choice.categoryId })
        imported += 1
      }
      setNotice(`${imported} ${imported === 1 ? 'transaction' : 'transactions'} imported.`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish the import')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const missingMonths = selectedCollection?.kind === 'monthly'
    ? Array.from(new Set(candidates.filter((candidate) => (
        (choices[candidate.id]?.included ?? false) && !destination(candidate)
      )).map((candidate) => candidate.date.slice(0, 7)))).sort()
    : []

  async function createMissingMonths() {
    if (!selectedCollection || selectedCollection.kind !== 'monthly') return
    setBusy(true)
    setError(null)
    try {
      for (const month of missingMonths) {
        await createTracker({
          collectionId: selectedCollection.id,
          month,
          copyBudgetsFrom: collectionTrackers[0]?.id,
        })
      }
      setNotice(`${missingMonths.length} missing monthly ${missingMonths.length === 1 ? 'tracker was' : 'trackers were'} created.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create monthly trackers')
    } finally {
      setBusy(false)
    }
  }

  const importableCount = candidates.filter((candidate) => (
    (choices[candidate.id]?.included ?? false) && destination(candidate)
  )).length
  const includedCandidates = candidates.filter((candidate) => choices[candidate.id]?.included ?? false)
  const visibleCandidates = candidates.filter((candidate) => {
    const included = choices[candidate.id]?.included ?? false
    return reviewFilter === 'all' || (reviewFilter === 'included' ? included : !included)
  })
  const selectedExpenses = includedCandidates
    .filter((candidate) => candidate.kind === 'expense')
    .reduce((total, candidate) => total + candidate.amount, 0)
  const selectedIncome = includedCandidates
    .filter((candidate) => candidate.kind === 'income')
    .reduce((total, candidate) => total + candidate.amount, 0)

  function setCandidateIncluded(candidate: ImportCandidate, included: boolean) {
    setChoices((current) => {
      const choice = current[candidate.id] ?? { included: false, categoryId: null }
      return { ...current, [candidate.id]: { ...choice, included } }
    })
  }

  function setAllIncluded(included: boolean) {
    setChoices((current) => Object.fromEntries(candidates.map((candidate) => [
      candidate.id,
      { ...(current[candidate.id] ?? { categoryId: null }), included },
    ])))
  }

  return (
    <div className="space-y-5 pb-6">
      <div>
        <Link to="/more" className="text-sm font-medium text-teal-800">← More</Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Import transactions</h1>
        <p className="mt-1 text-sm text-stone-500">Review every charge before it enters a tracker.</p>
      </div>

      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Import a card statement</h2>
        <p className="mt-1 text-sm text-stone-500">Capital One, American Express, Chase, and standard CSV files are supported. The file is parsed on this device.</p>
        <label className="mt-4 flex min-h-12 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-stone-300 px-4 font-medium text-teal-800">
          Choose CSV file
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void chooseCsv(event.target.files?.[0])} />
        </label>
        {csvResult ? (
          <div className="mt-4 space-y-3 rounded-2xl bg-stone-50 p-3">
            <div>
              <p className="font-medium">{csvResult.detectedFormat}</p>
              <p className="text-sm text-stone-500">{csvResult.rows.length} rows found</p>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-stone-100 p-1 text-xs font-medium">
              <button type="button" onClick={() => void changeSignConvention(true)} className={`min-h-10 rounded-lg ${csvResult.positiveMeansExpense ? 'bg-white shadow-sm' : 'text-stone-500'}`}>Positive = charge</button>
              <button type="button" onClick={() => void changeSignConvention(false)} className={`min-h-10 rounded-lg ${!csvResult.positiveMeansExpense ? 'bg-white shadow-sm' : 'text-stone-500'}`}>Negative = charge</button>
            </div>
            <button type="button" disabled={busy} onClick={() => void stageCsv()} className="w-full rounded-xl bg-teal-800 py-3 font-semibold text-white disabled:opacity-50">Review these transactions</button>
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Automatic bank sync</h2>
            <p className="mt-1 text-sm text-stone-500">Securely connect through Plaid. Bank credentials never enter Spend.</p>
          </div>
          <span className="rounded-full bg-stone-100 px-2 py-1 text-xs font-medium text-stone-500">Plaid</span>
        </div>
        {accounts.length ? <p className="mt-3 text-sm text-stone-600">Connected: {accounts.map((account) => `${account.name}${account.mask ? ` •${account.mask}` : ''}`).join(', ')}</p> : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => void connectBank()} className="min-h-12 rounded-xl bg-stone-100 font-medium disabled:opacity-50">Connect account</button>
          <button type="button" disabled={busy || !accounts.length} onClick={() => void syncBank()} className="min-h-12 rounded-xl bg-teal-800 font-medium text-white disabled:opacity-50">Sync now</button>
        </div>
      </section>

      {notice ? <p className="rounded-2xl bg-teal-50 p-3 text-sm text-teal-900">{notice}</p> : null}
      {error ? <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {candidates.length ? (
        <section className="space-y-3">
          <div className="rounded-3xl bg-white p-4 shadow-sm">
            <h2 className="font-semibold">Destination</h2>
            <label className="mt-3 block text-sm text-stone-500">Collection
              <select value={selectedCollection?.id ?? ''} onChange={(event) => setCollectionId(event.target.value)} className="mt-1 w-full rounded-xl bg-stone-50 px-3 py-3 text-stone-800 outline-none">
                {liveCollections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
              </select>
            </label>
            {selectedCollection?.kind === 'custom' ? (
              <label className="mt-3 block text-sm text-stone-500">Tracker
                <select value={customTrackerId} onChange={(event) => setCustomTrackerId(event.target.value)} className="mt-1 w-full rounded-xl bg-stone-50 px-3 py-3 text-stone-800 outline-none">
                  {collectionTrackers.map((tracker) => <option key={tracker.id} value={tracker.id}>{tracker.name}</option>)}
                </select>
              </label>
            ) : (
              <div className="mt-3">
                <p className="text-sm text-stone-500">Each transaction will go to the monthly tracker containing its date.</p>
                {missingMonths.length ? (
                  <button type="button" disabled={busy} onClick={() => void createMissingMonths()} className="mt-3 min-h-11 w-full rounded-xl bg-amber-50 px-3 text-sm font-medium text-amber-900 disabled:opacity-50">
                    Create {missingMonths.length} missing {missingMonths.length === 1 ? 'month' : 'months'}
                  </button>
                ) : null}
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">Choose transactions</h2>
                <p className="mt-0.5 text-sm text-stone-500">Only selected items will enter your tracker.</p>
              </div>
              <span className="shrink-0 rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-800">
                {includedCandidates.length}/{candidates.length}
              </span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-teal-700 transition-[width] duration-300" style={{ width: `${candidates.length ? (includedCandidates.length / candidates.length) * 100 : 0}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setAllIncluded(true)} className="min-h-11 rounded-xl bg-teal-50 px-3 text-sm font-semibold text-teal-800">Select all</button>
              <button type="button" onClick={() => setAllIncluded(false)} className="min-h-11 rounded-xl bg-stone-100 px-3 text-sm font-semibold text-stone-600">Clear all</button>
            </div>
            <div className="mt-3 grid grid-cols-3 rounded-xl bg-stone-100 p-1 text-xs font-semibold">
              {([
                ['all', `All ${candidates.length}`],
                ['included', `Selected ${includedCandidates.length}`],
                ['excluded', `Skipped ${candidates.length - includedCandidates.length}`],
              ] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setReviewFilter(value)} className={`min-h-9 rounded-lg px-1 transition ${reviewFilter === value ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
                  {label}
                </button>
              ))}
            </div>
            {includedCandidates.length ? (
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-stone-100 pt-3 text-sm">
                <span className="text-stone-500">Selected totals</span>
                <span className="text-right font-medium">
                  {selectedExpenses ? `${formatMoney(selectedExpenses)} spent` : ''}
                  {selectedExpenses && selectedIncome ? ' · ' : ''}
                  {selectedIncome ? `${formatMoney(selectedIncome)} earned` : ''}
                </span>
              </div>
            ) : null}
          </div>
          {visibleCandidates.map((candidate) => {
            const choice = choices[candidate.id] ?? { included: false, categoryId: null }
            const target = destination(candidate)
            const matchingCategories = categories.filter((category) => category.kind === candidate.kind)
            return (
              <article key={candidate.id} className={`rounded-3xl border p-4 shadow-sm transition ${choice.included ? 'border-teal-100 bg-white' : 'border-transparent bg-stone-100/70 opacity-70'}`}>
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    aria-pressed={choice.included}
                    aria-label={`${choice.included ? 'Exclude' : 'Include'} ${candidate.merchant}`}
                    onClick={() => setCandidateIncluded(candidate, !choice.included)}
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition ${choice.included ? 'border-teal-700 bg-teal-700 text-white' : 'border-stone-300 bg-white text-transparent'}`}
                  >
                    ✓
                  </button>
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => setCandidateIncluded(candidate, !choice.included)} className="flex w-full items-start justify-between gap-3 text-left">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{candidate.merchant}</span>
                        <span className="mt-0.5 block text-xs text-stone-500">{formatDate(candidate.date)} · {candidate.account_name || (candidate.provider === 'plaid' ? 'Plaid' : 'CSV')}</span>
                      </span>
                      <span className={`shrink-0 font-semibold ${candidate.kind === 'income' ? 'text-emerald-700' : ''}`}>{candidate.kind === 'income' ? '+' : ''}{formatMoney(candidate.amount)}</span>
                    </button>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-stone-500">{candidate.provider === 'plaid' ? 'Plaid' : 'CSV'}</span>
                      {candidate.pending ? <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">Pending</span> : null}
                      {!choice.included ? <span className="rounded-full bg-stone-200 px-2 py-1 text-[11px] font-medium text-stone-600">Will be skipped</span> : null}
                    </div>
                    {choice.included ? (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <select value={choice.categoryId ?? ''} onChange={(event) => setChoices({ ...choices, [candidate.id]: { ...choice, categoryId: event.target.value || null } })} className="min-w-0 rounded-xl bg-stone-50 px-2 py-2 text-sm outline-none">
                          <option value="">Uncategorized</option>
                          {matchingCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                        </select>
                        <div className={`rounded-xl px-2 py-2 text-sm ${target ? 'bg-stone-50 text-stone-600' : 'bg-amber-50 text-amber-800'}`}>{target?.name ?? 'Create matching month'}</div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            )
          })}
          {!visibleCandidates.length ? (
            <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
              <p className="font-medium">No transactions in this view</p>
              <button type="button" onClick={() => setReviewFilter('all')} className="mt-2 text-sm font-semibold text-teal-800">Show all transactions</button>
            </div>
          ) : null}
          <div className="sticky bottom-24 z-20 rounded-2xl border border-white/80 bg-white/95 p-3 shadow-lg backdrop-blur">
            <div className="mb-2 flex items-center justify-between px-1 text-xs text-stone-500">
              <span>{includedCandidates.length} selected</span>
              <span>{importableCount === includedCandidates.length ? 'Ready to import' : `${importableCount} have a destination`}</span>
            </div>
            <button type="button" disabled={busy || importableCount === 0} onClick={() => setConfirmingImport(true)} className="min-h-12 w-full rounded-xl bg-teal-800 px-4 font-semibold text-white disabled:opacity-50">{busy ? 'Importing…' : `Review ${importableCount} selected`}</button>
          </div>
        </section>
      ) : (
        <div className="rounded-3xl bg-white p-6 text-center shadow-sm"><p className="font-medium">Nothing waiting for review</p><p className="mt-1 text-sm text-stone-500">Choose a CSV or connect a card to begin.</p></div>
      )}

      {confirmingImport ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3" role="dialog" aria-modal="true" aria-labelledby="confirm-import-title">
          <button type="button" aria-label="Close import confirmation" onClick={() => setConfirmingImport(false)} className="absolute inset-0" />
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-stone-200" />
            <h2 id="confirm-import-title" className="text-xl font-semibold">Import {importableCount} {importableCount === 1 ? 'transaction' : 'transactions'}?</h2>
            <p className="mt-1 text-sm text-stone-500">Only the transactions you selected will be added. The other {candidates.length - includedCandidates.length} will be skipped.</p>
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-stone-50 p-3 text-sm">
              <div><p className="text-stone-500">Expenses</p><p className="mt-1 font-semibold">{formatMoney(selectedExpenses)}</p></div>
              <div><p className="text-stone-500">Income</p><p className="mt-1 font-semibold text-emerald-700">{formatMoney(selectedIncome)}</p></div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmingImport(false)} className="min-h-12 rounded-xl bg-stone-100 px-4 font-semibold text-stone-700">Keep reviewing</button>
              <button type="button" onClick={() => void importReviewed()} className="min-h-12 rounded-xl bg-teal-800 px-4 font-semibold text-white">Import selected</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
