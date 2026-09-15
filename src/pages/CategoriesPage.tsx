import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTrackers } from '../context/TrackerContext'
import { formatMoney } from '../lib/format'
import { createCategory, deleteCategory, listCategories, updateCategory } from '../lib/queries'
import { TRACKER_COLORS, type Category, type Kind } from '../types'

export function CategoriesPage() {
  const { active } = useTrackers()
  const [rows, setRows] = useState<Category[]>([])
  const [name, setName] = useState('')
  const [kind, setKind] = useState<Kind>('expense')
  const [color, setColor] = useState<string>(TRACKER_COLORS[0])
  const [budget, setBudget] = useState('')
  const [editing, setEditing] = useState<Category | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!active) return
    setRows(await listCategories(active.id, active.collection_id))
  }, [active])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!active || !name.trim()) return
    const budgetAmount = budget ? Number.parseFloat(budget) : null
    if (budgetAmount !== null && (!Number.isFinite(budgetAmount) || budgetAmount < 0)) {
      setError('Enter a valid budget amount')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createCategory({
        trackerId: active.id,
        collectionId: active.collection_id,
        name,
        color,
        kind,
        budget: kind === 'expense' ? budgetAmount : null,
        sortOrder: rows.length,
      })
      setName('')
      setBudget('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add category')
    } finally {
      setBusy(false)
    }
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault()
    if (!active || !editing || !editing.name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await updateCategory(editing.id, {
        name: editing.name.trim(),
        color: editing.color,
        budget: editing.kind === 'expense' ? editing.budget : null,
      }, active.id)
      setEditing(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save category')
    } finally {
      setBusy(false)
    }
  }

  if (!active) return <p className="py-8 text-stone-500">Create a tracker first.</p>

  const sections: Array<{ kind: Kind; label: string }> = [
    { kind: 'expense', label: 'Expense categories' },
    { kind: 'income', label: 'Income categories' },
  ]

  return (
    <div className="space-y-5 pb-6">
      <div>
        <Link to="/more" className="text-sm font-medium text-teal-800">
          ← More
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Categories & budgets</h1>
        <p className="mt-1 text-sm text-stone-500">Set spending targets for {active.name}.</p>
      </div>

      <form onSubmit={onCreate} className="space-y-4 rounded-3xl bg-white p-4 shadow-sm">
        <p className="font-semibold">Add a category</p>
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-stone-100 p-1">
          {(['expense', 'income'] as const).map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => {
                setKind(choice)
                if (choice === 'income') setBudget('')
              }}
              className={`min-h-11 rounded-xl font-medium capitalize transition ${
                kind === choice ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
              }`}
            >
              {choice}
            </button>
          ))}
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Category name"
          className="w-full rounded-2xl bg-stone-50 px-4 py-3 outline-none"
        />
        {kind === 'expense' ? (
          <label className="block">
            <span className="mb-1 block text-sm text-stone-500">Budget (optional)</span>
            <div className="flex items-center rounded-2xl bg-stone-50 px-4">
              <span className="text-stone-400">$</span>
              <input
                inputMode="decimal"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="500"
                className="min-w-0 flex-1 bg-transparent px-2 py-3 outline-none"
              />
            </div>
          </label>
        ) : null}
        <CategoryColorPicker value={color} onChange={setColor} />
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="w-full rounded-2xl bg-teal-800 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Adding…' : 'Add category'}
        </button>
      </form>

      {sections.map((section) => {
        const categories = rows.filter((row) => row.kind === section.kind)
        if (categories.length === 0) return null
        return (
          <section key={section.kind}>
            <h2 className="mb-2 px-1 text-xs font-semibold tracking-wide text-stone-500 uppercase">
              {section.label}
            </h2>
            <ul className="space-y-2">
              {categories.map((category) => (
                <li key={category.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                  {editing?.id === category.id ? (
                    <form onSubmit={onSaveEdit} className="space-y-3 p-4">
                      <input
                        autoFocus
                        value={editing.name}
                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        className="w-full rounded-xl bg-stone-50 px-3 py-3 outline-none"
                      />
                      {editing.kind === 'expense' ? (
                        <label className="block">
                          <span className="mb-1 block text-xs text-stone-500">Budget</span>
                          <div className="flex items-center rounded-xl bg-stone-50 px-3">
                            <span className="text-stone-400">$</span>
                            <input
                              inputMode="decimal"
                              value={editing.budget ?? ''}
                              onChange={(e) =>
                                setEditing({
                                  ...editing,
                                  budget: e.target.value === '' ? null : Number(e.target.value),
                                })
                              }
                              placeholder="No budget"
                              className="min-w-0 flex-1 bg-transparent px-2 py-3 outline-none"
                            />
                          </div>
                        </label>
                      ) : null}
                      <CategoryColorPicker
                        value={editing.color}
                        onChange={(next) => setEditing({ ...editing, color: next })}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          className="min-h-11 rounded-xl bg-stone-100 font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={busy || !editing.name.trim()}
                          className="min-h-11 rounded-xl bg-teal-800 font-medium text-white disabled:opacity-50"
                        >
                          Save
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center gap-3 p-4">
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-semibold text-white"
                        style={{ backgroundColor: category.color }}
                      >
                        {category.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{category.name}</p>
                        <p className="text-xs text-stone-500">
                          {category.kind === 'expense' && category.budget !== null
                            ? `${formatMoney(category.budget)} budget`
                            : category.kind === 'expense'
                              ? 'No budget set'
                              : 'Income'}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="min-h-11 px-2 text-sm font-medium text-teal-800"
                        onClick={() => setEditing({ ...category })}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="min-h-11 px-1 text-sm font-medium text-red-700"
                        onClick={async () => {
                          if (!confirm(`Delete ${category.name}? Existing transactions will become uncategorized.`)) return
                          await deleteCategory(category.id)
                          await refresh()
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function CategoryColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (color: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Category color">
      {TRACKER_COLORS.slice(0, 10).map((choice) => (
        <button
          key={choice}
          type="button"
          onClick={() => onChange(choice)}
          className={`h-9 w-9 rounded-full border-4 border-white ${
            value === choice ? 'ring-2 ring-stone-900' : ''
          }`}
          style={{ backgroundColor: choice }}
          aria-label={`Use color ${choice}`}
          aria-pressed={value === choice}
        />
      ))}
      <label className="flex h-9 items-center gap-1 rounded-full bg-stone-100 px-2 text-xs font-medium text-stone-600">
        Custom
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-6 rounded-full border-0 bg-transparent p-0"
          aria-label="Choose any category color"
        />
      </label>
    </div>
  )
}
