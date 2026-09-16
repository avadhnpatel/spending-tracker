import type { Category, ImportCandidate, Tracker, TrackerCollection } from '../types'

export function listActiveTrackers(trackers: Tracker[], collections: TrackerCollection[]): Tracker[] {
  const activeCollectionIds = new Set(collections.filter((collection) => !collection.archived_at).map((collection) => collection.id))
  return trackers.filter((tracker) => !tracker.archived_at && activeCollectionIds.has(tracker.collection_id))
}

export function filterCardCandidates(candidates: ImportCandidate[], search: string, accountId = 'all'): ImportCandidate[] {
  const query = search.trim().toLowerCase()
  return candidates.filter((candidate) => (
    (accountId === 'all' || candidate.account_id === accountId) &&
    (!query || `${candidate.merchant} ${candidate.account_name}`.toLowerCase().includes(query))
  ))
}

export function filterCandidatesByDate(candidates: ImportCandidate[], startDate = '', endDate = ''): ImportCandidate[] {
  return candidates.filter((candidate) => (
    (!startDate || candidate.date >= startDate) && (!endDate || candidate.date <= endDate)
  ))
}

export function suggestCardCategory(candidate: ImportCandidate, tracker: Tracker, categories: Category[]): Category | null {
  const hint = candidate.category_hint.toLowerCase().replaceAll('_', ' ')
  if (!hint) return null
  return categories.find((category) => category.collection_id === tracker.collection_id && category.kind === candidate.kind && (
    hint.includes(category.name.toLowerCase()) || category.name.toLowerCase().includes(hint)
  )) ?? null
}
