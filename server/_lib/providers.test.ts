import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertRecoverableSpendProject, providerErrorMessage, spendOwnerConfigurationSql, vercelProjectNameCandidates } from './providers'
import type { SetupSession } from './types'

afterEach(() => vi.unstubAllEnvs())

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

describe('spendOwnerConfigurationSql', () => {
  it('normalizes and safely quotes the verified directory email', () => {
    expect(spendOwnerConfigurationSql("  Owner.O'Brien@Example.COM "))
      .toBe("select public.configure_spend_owner('owner.o''brien@example.com');")
  })

  it('requires an owner before a private schema can be installed', () => {
    expect(() => spendOwnerConfigurationSql(null)).toThrow('owner email is missing')
  })
})

describe('private project recovery', () => {
  it('rejects the provisioning project before any management API request', async () => {
    vi.stubEnv('SETUP_SUPABASE_URL', 'https://bezcwdmaipsqzqgvlfjs.supabase.co')
    await expect(assertRecoverableSpendProject({} as SetupSession, 'bezcwdmaipsqzqgvlfjs'))
      .rejects.toThrow('provisioning project cannot be used')
  })
})
