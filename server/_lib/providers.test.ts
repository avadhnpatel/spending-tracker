import { describe, expect, it } from 'vitest'
import { providerErrorMessage, vercelProjectNameCandidates } from './providers'

describe('providerErrorMessage', () => {
  it('extracts messages from nested provider errors', () => {
    expect(providerErrorMessage({ error: { message: 'Database is still starting' } }, 500))
      .toBe('Database is still starting')
  })

  it('never renders an object as [object Object]', () => {
    expect(providerErrorMessage({ error: { code: 'unknown' } }, 503))
      .toBe('Provider request failed (503)')
  })
})

describe('vercelProjectNameCandidates', () => {
  it('uses a deterministic fallback when the preferred name is unavailable or tombstoned', () => {
    expect(vercelProjectNameCandidates('avadhandvraj/Spend Private', '12345678-abcd-4321-abcd-1234567890ab'))
      .toEqual([
        'spend-private',
        'spend-private-12345678abcd',
        'spend-private-12345678abcd-2',
        'spend-private-12345678abcd-3',
        'spend-private-12345678abcd-4',
        'spend-private-12345678abcd-5',
      ])
  })
})
