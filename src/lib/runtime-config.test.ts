import { describe, expect, it } from 'vitest'
import { isValidRuntimeSupabaseConfig } from './runtime-config'

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
