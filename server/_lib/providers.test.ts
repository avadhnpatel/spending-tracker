import { describe, expect, it } from 'vitest'
import { providerErrorMessage } from './providers'

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
