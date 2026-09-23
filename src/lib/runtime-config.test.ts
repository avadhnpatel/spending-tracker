import { describe, expect, it } from 'vitest'
import { isValidRuntimeSupabaseConfig, runtimeConfigForPrivateApp, sameRuntimeConfig } from './runtime-config'

describe('isValidRuntimeSupabaseConfig', () => {
  it('accepts an HTTPS Supabase runtime configuration', () => {
    expect(isValidRuntimeSupabaseConfig({
      url: 'https://abc123.supabase.co',
      publishableKey: 'sb_publishable_example',
      deploymentUrl: 'https://my-private-spend.vercel.app',
    })).toBe(true)
  })

  it('rejects local, malformed, and secretless configuration values', () => {
    expect(isValidRuntimeSupabaseConfig({ url: 'http://localhost:54321', publishableKey: 'key' })).toBe(false)
    expect(isValidRuntimeSupabaseConfig({ url: 'not a URL', publishableKey: 'key' })).toBe(false)
    expect(isValidRuntimeSupabaseConfig({ url: 'https://abc123.supabase.co', publishableKey: '' })).toBe(false)
    expect(isValidRuntimeSupabaseConfig(null)).toBe(false)
  })
})

describe('directory-owned private database configuration', () => {
  const app = {
    deployment_url: 'https://spendingtrkr.com',
    supabase_project_ref: 'abcdefghijklmnopqrst',
    supabase_publishable_key: 'sb_publishable_example',
  }

  it('uses the mapped project reference instead of a cached URL', () => {
    const current = runtimeConfigForPrivateApp(app)
    expect(current.url).toBe('https://abcdefghijklmnopqrst.supabase.co')
    expect(sameRuntimeConfig({ ...current, url: 'https://oldproject123456789.supabase.co' }, current)).toBe(false)
    expect(sameRuntimeConfig(current, current)).toBe(true)
  })

  it('rejects an invalid project reference from the directory', () => {
    expect(() => runtimeConfigForPrivateApp({ ...app, supabase_project_ref: 'not-a-ref.supabase.co' })).toThrow('reference is invalid')
  })
})
