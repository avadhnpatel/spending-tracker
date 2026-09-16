import { describe, expect, it } from 'vitest'
import type { Category, ImportCandidate, Tracker, TrackerCollection } from '../types'
import { filterCandidatesByDate, filterCardCandidates, listActiveTrackers, suggestCardCategory } from './card-activity'

const candidate = {
  id: 'candidate-1',
  user_id: 'user-1',
  provider: 'plaid',
  external_id: 'plaid-1',
  connection_id: 'connection-1',
  account_id: 'account-1',
  account_name: 'Capital One Venture',
  date: '2026-09-15',
  amount: 24.5,
  kind: 'expense',
  merchant: 'Corner Coffee',
  category_hint: 'FOOD_AND_DRINK',
  pending: false,
  status: 'pending',
  imported_transaction_id: null,
  created_at: '2026-09-15T12:00:00Z',
  updated_at: '2026-09-15T12:00:00Z',
} satisfies ImportCandidate

const tracker = {
  id: 'tracker-1',
  user_id: 'user-1',
  collection_id: 'collection-1',
  name: 'September 2026',
  note: '',
  color: '#0f766e',
  period_start: '2026-09-01',
  period_end: '2026-09-30',
  archived_at: null,
  created_at: '2026-09-01T00:00:00Z',
} satisfies Tracker

describe('Card activity', () => {
  it('searches card activity by merchant or account without changing empty searches', () => {
    expect(filterCardCandidates([candidate], '')).toEqual([candidate])
    expect(filterCardCandidates([candidate], 'coffee')).toEqual([candidate])
    expect(filterCardCandidates([candidate], 'venture')).toEqual([candidate])
    expect(filterCardCandidates([candidate], 'airline')).toEqual([])
    expect(filterCardCandidates([candidate], '', 'account-1')).toEqual([candidate])
    expect(filterCardCandidates([candidate], '', 'account-2')).toEqual([])
  })

  it('filters card activity by a single date or inclusive date range', () => {
    const rows = [
      { ...candidate, id: 'before', date: '2026-09-10' },
      candidate,
      { ...candidate, id: 'after', date: '2026-09-20' },
    ]

    expect(filterCandidatesByDate(rows, '2026-09-15', '2026-09-15').map((row) => row.id)).toEqual(['candidate-1'])
    expect(filterCandidatesByDate(rows, '2026-09-11', '2026-09-20').map((row) => row.id)).toEqual(['candidate-1', 'after'])
    expect(filterCandidatesByDate(rows, '2026-09-15').map((row) => row.id)).toEqual(['candidate-1', 'after'])
  })

  it('suggests a category only from the chosen tracker collection and matching kind', () => {
    const categories = [
      { id: 'wrong-collection', collection_id: 'collection-2', kind: 'expense', name: 'Food and drink' },
      { id: 'wrong-kind', collection_id: 'collection-1', kind: 'income', name: 'Food and drink' },
      { id: 'match', collection_id: 'collection-1', kind: 'expense', name: 'Food' },
    ].map((row, sort_order) => ({ tracker_id: tracker.id, color: '#0f766e', budget: null, sort_order, ...row })) as Category[]

    expect(suggestCardCategory(candidate, tracker, categories)?.id).toBe('match')
    expect(suggestCardCategory({ ...candidate, category_hint: '' }, tracker, categories)).toBeNull()
  })

  it('offers trackers only when both tracker and collection are active', () => {
    const collections = [
      { id: 'collection-1', archived_at: null },
      { id: 'collection-2', archived_at: '2026-09-01T00:00:00Z' },
    ].map((row) => ({ user_id: 'user-1', name: row.id, note: '', color: '#0f766e', kind: 'custom', created_at: '2026-09-01T00:00:00Z', ...row })) as TrackerCollection[]
    const trackers = [
      tracker,
      { ...tracker, id: 'archived-tracker', archived_at: '2026-09-10T00:00:00Z' },
      { ...tracker, id: 'archived-collection-tracker', collection_id: 'collection-2' },
    ]

    expect(listActiveTrackers(trackers, collections).map((row) => row.id)).toEqual(['tracker-1'])
  })
})
