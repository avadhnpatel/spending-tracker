import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTrackers } from '../context/TrackerContext'
import { todayISO } from '../lib/format'
import { compressReceipt } from '../lib/image'
import {
  createCategory,
  deleteTransaction,
  getTransaction,
  listCategories,
  removeReceipt,
  receiptUrl,
  uploadReceipt,
  upsertTransaction,
} from '../lib/queries'
import { TRACKER_COLORS, type Category, type Kind } from '../types'

export function AddTransactionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { active, setActiveId } = useTrackers()
  const [categories, setCategories] = useState<Category[]>([])
  const [kind, setKind] = useState<Kind>('expense')
  const [amount, setAmount] = useState('')
  const [merchant, setMerchant] = useState('')
  const [date, setDate] = useState(todayISO())
  const [notes, setNotes] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [receiptPath, setReceiptPath] = useState<string | null>(null)
  const [selectedReceipt, setSelectedReceipt] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState<string>(TRACKER_COLORS[0])
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!active) return
    listCategories(active.id).then(setCategories)
  }, [active])

  useEffect(() => {
    if (!id) return
    getTransaction(id).then((t) => {
      if (!t) return
      if (active && t.tracker_id !== active.id) setActiveId(t.tracker_id)
      setKind(t.kind)
      setAmount(String(t.amount))
      setMerchant(t.merchant)
      setDate(t.date)
      setNotes(t.notes)
      setCategoryId(t.category_id)
      setReceiptPath(t.receipt_path)
      if (t.receipt_path) void receiptUrl(t.receipt_path).then(setPreview)
    })
  }, [active, id, setActiveId])

  const visibleCats = categories.filter((c) => c.kind === kind)

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setCompressing(true)
    try {
      const compressed = await compressReceipt(file)
      setSelectedReceipt(compressed)
      setPreview(URL.createObjectURL(compressed))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not prepare receipt')
    } finally {
      setCompressing(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!active || !user) return
    const n = Number.parseFloat(amount)
    if (!Number.isFinite(n) || n <= 0) {
      setError('Enter an amount greater than 0')
      return
    }
    setSaving(true)
    setError(null)
    let uploadedPath: string | null = null
    try {
      if (selectedReceipt) {
        uploadedPath = await uploadReceipt(user.id, active.id, selectedReceipt)
      }
      await upsertTransaction({
        id,
        tracker_id: active.id,
        category_id: categoryId,
        recurring_id: null,
        amount: n,
        kind,
        date,
        merchant: merchant.trim(),
        notes: notes.trim(),
        receipt_path: uploadedPath ?? receiptPath,
      })
      if (uploadedPath && receiptPath) {
        void removeReceipt(receiptPath).catch(() => undefined)
      }
      navigate(-1)
    } catch (err) {
      if (uploadedPath) void removeReceipt(uploadedPath).catch(() => undefined)
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  async function onCreateCategory() {
    const name = newCategoryName.trim()
    if (!active || !name) {
      setError('Enter a category name')
      return
    }

    setCreatingCategory(true)
    setError(null)
    try {
      const category = await createCategory({
        trackerId: active.id,
        name,
        color: newCategoryColor,
        kind,
        sortOrder: categories.length,
      })
      setCategories((current) => [...current, category])
      setCategoryId(category.id)
      setNewCategoryName('')
      setShowNewCategory(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create category')
    } finally {
      setCreatingCategory(false)
    }
  }

  async function onDelete() {
    if (!id || !confirm('Delete this transaction?')) return
    await deleteTransaction(id, receiptPath)
    navigate(-1)
  }

  if (!active) return <p className="py-8 text-stone-500">Create a tracker first.</p>

  return (
    <form onSubmit={onSubmit} className="space-y-4 pb-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{id ? 'Edit' : 'Add'} transaction</h1>
        <p className="mt-1 text-sm text-stone-500">Saving to {active.name}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-stone-200/60 p-1">
        {(['expense', 'income'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k)
              setCategoryId(null)
              setShowNewCategory(false)
            }}
            className={`min-h-11 rounded-xl font-medium capitalize transition ${
              kind === k ? 'text-white shadow-sm' : 'text-stone-600'
            }`}
            style={kind === k ? { backgroundColor: active.color } : undefined}
          >
            {k}
          </button>
        ))}
      </div>
      <label className="block rounded-3xl bg-white p-4 shadow-sm">
        <span className="mb-1 block text-sm text-stone-500">Amount</span>
        <span className="flex items-center">
          <span className="mr-1 text-3xl font-semibold text-stone-300">$</span>
          <input
            autoFocus={!id}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="min-w-0 flex-1 bg-transparent py-2 text-4xl font-semibold tracking-tight outline-none"
          />
        </span>
      </label>
      <div>
        <p className="mb-2 text-sm text-stone-500">Category</p>
        <div className="flex flex-wrap gap-2">
          {visibleCats.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={`min-h-10 rounded-full px-3 py-1.5 text-sm font-medium ${
                categoryId === c.id ? 'text-white' : 'bg-white text-stone-700'
              }`}
              style={categoryId === c.id ? { background: c.color } : undefined}
            >
              {c.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowNewCategory((current) => !current)}
            className="min-h-11 rounded-full border border-dashed px-3 py-1.5 text-sm font-medium"
            style={{ borderColor: active.color, color: active.color }}
            aria-expanded={showNewCategory}
          >
            + New category
          </button>
        </div>
        {showNewCategory ? (
          <div className="mt-3 space-y-3 rounded-2xl bg-white p-3">
            <div>
              <label htmlFor="new-category-name" className="mb-1 block text-sm text-stone-500">
                New {kind} category in {active.name}
              </label>
              <input
                id="new-category-name"
                autoFocus
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void onCreateCategory()
                  }
                }}
                placeholder="Category name"
                className="w-full rounded-xl bg-stone-100 px-3 py-3 outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Category color">
              {TRACKER_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setNewCategoryColor(color)}
                  className={`h-11 w-11 rounded-full border-4 ${
                    newCategoryColor === color ? 'border-stone-800' : 'border-white'
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Use color ${color}`}
                  aria-pressed={newCategoryColor === color}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowNewCategory(false)
                  setNewCategoryName('')
                }}
                className="min-h-11 rounded-xl bg-stone-100 px-3 font-medium text-stone-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void onCreateCategory()}
                disabled={creatingCategory || !newCategoryName.trim()}
                className="min-h-11 rounded-xl bg-teal-800 px-3 font-medium text-white disabled:opacity-50"
              >
                {creatingCategory ? 'Creating…' : 'Create & select'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <input
        value={merchant}
        onChange={(e) => setMerchant(e.target.value)}
        placeholder="Merchant"
        className="w-full rounded-2xl bg-white px-4 py-3 outline-none"
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full rounded-2xl bg-white px-4 py-3 outline-none"
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes"
        rows={3}
        className="w-full rounded-2xl bg-white px-4 py-3 outline-none"
      />
      <label className="block rounded-2xl bg-white px-4 py-3 text-sm font-medium text-teal-800">
        {compressing
          ? 'Compressing…'
          : preview
            ? 'Replace receipt photo'
            : 'Add receipt photo'}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={compressing}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </label>
      {preview ? (
        <img src={preview} alt="Receipt" className="max-h-48 w-full rounded-2xl object-cover" />
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={saving || compressing}
        className="w-full rounded-2xl py-3.5 font-semibold text-white shadow-lg disabled:opacity-60"
        style={{ backgroundColor: active.color }}
      >
        {saving ? 'Saving and syncing…' : 'Save'}
      </button>
      {id ? (
        <button
          type="button"
          onClick={() => void onDelete()}
          className="w-full py-2 text-sm font-medium text-red-700"
        >
          Delete
        </button>
      ) : null}
    </form>
  )
}
