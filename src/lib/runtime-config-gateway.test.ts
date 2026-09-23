import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./directory', () => ({
  directorySupabase: { auth: { signOut: vi.fn() } },
  directorySession: vi.fn(async () => null),
  isPrivateAppGateway: true,
}))
vi.mock('./platform', () => ({ isNativePlatform: () => false, provisioningBaseUrl: () => 'https://spendingtrkr.com' }))

import { getRuntimeSupabaseConfig } from './runtime-config'

afterEach(() => vi.unstubAllGlobals())

describe('gateway startup', () => {
  it('clears a cached private project when the directory account is signed out', async () => {
    const values = new Map([['spend.runtimeSupabaseConfig.v1', JSON.stringify({
      url: 'https://abcdefghijklmnopqrst.supabase.co',
      publishableKey: 'sb_publishable_old',
    })]])
    vi.stubGlobal('window', { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
    } })

    expect(await getRuntimeSupabaseConfig()).toBeNull()
    expect(values.size).toBe(0)
  })
})
