import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTrackers } from '../context/TrackerContext'
import { createCategory, deleteCategory, listCategories, updateCategory } from '../lib/queries'
import { TRACKER_COLORS, type Category, type Kind } from '../types'

export function CategoriesPage() {
  const { active } = useTrackers()
  const [rows, setRows] = useState<Category[]>([])
  const [name, setName] = useState('')
  const [kind, setKind] = useState<Kind>('expense')
  const [color, setColor] = useState<string>(TRACKER_COLORS[0])

  const refresh = useCallback(async () => {
    if (!active) return
    setRows(await listCategories(active.id))
  }, [active])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!active || !name.trim()) return
    await createCategory({
      trackerId: active.id,
      name,
      color,
      kind,
      sortOrder: rows.length,
    })
    setName('')
    await refresh()
  }

  if (!active) return <p className="py-8 text-stone-500">Create a tracker first.</p>

  return (
    <div className="space-y-4 pb-6">
      <Link to="/more" className="text-sm font-medium text-teal-800">
        ← More
      </Link>
      <h1 className="text-2xl font-semibold">Categories</h1>
      <p className="text-sm text-stone-500">Only for {active.name}</p>

      <form onSubmit={onCreate} className="space-y-3 rounded-3xl bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-2">
          {(['expense', 'income'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-xl py-2 font-medium capitalize ${
                kind === k ? 'bg-teal-800 text-white' : 'bg-stone-50'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="w-full rounded-2xl bg-stone-50 px-4 py-3 outline-none"
        />
        <div className="flex flex-wrap gap-2">
          {TRACKER_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-7 w-7 rounded-full ${color === c ? 'ring-2 ring-offset-2 ring-stone-900' : ''}`}
              style={{ background: c }}
            />
          ))}
        </div>
        <button type="submit" className="w-full rounded-2xl bg-teal-800 py-3 font-semibold text-white">
          Add category
        </button>
      </form>

      <ul className="space-y-2">
        {rows.map((c) => (
          <li key={c.id} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
              <span>
                {c.name}
                <span className="ml-2 text-xs text-stone-400">{c.kind}</span>
              </span>
            </span>
            <span className="flex gap-3 text-sm font-medium">
              <button
                type="button"
                className="text-teal-800"
                onClick={async () => {
                  const next = prompt('Rename category', c.name)
                  if (!next?.trim()) return
                  await updateCategory(c.id, { name: next.trim() })
                  await refresh()
                }}
              >
                Rename
              </button>
              <button
                type="button"
                className="text-red-700"
                onClick={async () => {
                  if (!confirm('Delete this category?')) return
                  await deleteCategory(c.id)
                  await refresh()
                }}
              >
                Delete
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
