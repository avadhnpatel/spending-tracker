import { afterEach, describe, expect, it, vi } from 'vitest'
import { privateAppForUser } from './store'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('private app directory mapping', () => {
  it('does not resurrect a removed mapping from a completed setup session', async () => {
    vi.stubEnv('SETUP_SUPABASE_URL', 'https://bezcwdmaipsqzqgvlfjs.supabase.co')
    vi.stubEnv('SETUP_SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')
    const paths: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      paths.push(input)
      return { ok: true, text: async () => '[]' }
    }))

    expect(await privateAppForUser('directory-user', 'owner@example.com')).toBeNull()
    expect(paths).toHaveLength(2)
    expect(paths.every((path) => path.includes('/private_apps?'))).toBe(true)
  })
})
