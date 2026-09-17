import { describe, expect, it } from 'vitest'
import { parseSupabaseRegionGroup, supabaseProjectBody } from './supabase-project'

describe('Supabase project creation', () => {
  it('sends exactly one smart region selection', () => {
    expect(supabaseProjectBody('my-org', 'spend-private', 'secret', 'americas')).toEqual({
      organization_slug: 'my-org',
      name: 'spend-private',
      db_pass: 'secret',
      region_selection: { type: 'smartGroup', code: 'americas' },
    })
    expect(supabaseProjectBody('my-org', 'spend-private', 'secret', 'americas')).not.toHaveProperty('region')
  })

  it('accepts supported region groups and safely defaults old clients', () => {
    expect(parseSupabaseRegionGroup('emea')).toBe('emea')
    expect(parseSupabaseRegionGroup('apac')).toBe('apac')
    expect(parseSupabaseRegionGroup(undefined)).toBe('americas')
    expect(parseSupabaseRegionGroup('invalid')).toBe('americas')
  })
})
