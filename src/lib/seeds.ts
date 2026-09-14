import type { Kind } from '../types'

export const DEFAULT_CATEGORIES: { name: string; color: string; kind: Kind }[] = [
  { name: 'Food', color: '#ea580c', kind: 'expense' },
  { name: 'Groceries', color: '#16a34a', kind: 'expense' },
  { name: 'Rent', color: '#7c3aed', kind: 'expense' },
  { name: 'Utilities', color: '#0284c7', kind: 'expense' },
  { name: 'Transport', color: '#0f766e', kind: 'expense' },
  { name: 'Shopping', color: '#db2777', kind: 'expense' },
  { name: 'Health', color: '#e11d48', kind: 'expense' },
  { name: 'Entertainment', color: '#4f46e5', kind: 'expense' },
  { name: 'Travel', color: '#0369a1', kind: 'expense' },
  { name: 'Other', color: '#57534e', kind: 'expense' },
  { name: 'Paycheck', color: '#15803d', kind: 'income' },
  { name: 'Other income', color: '#0f766e', kind: 'income' },
]
