import { describe, expect, it } from 'vitest'
import { controlPlaneProjectRef, isControlPlaneProject, parseSupabaseRegionGroup, resumableSupabaseProjectName, supabaseProjectBody } from './supabase-project'

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

  it('uses a deterministic project name so an interrupted create can be recovered', () => {
    expect(resumableSupabaseProjectName(' My Spend! ', '123e4567-e89b-12d3-a456-426614174000')).toBe('my-spend-123e4567e8')
    expect(resumableSupabaseProjectName('', '')).toBe('spend-private')
  })

  it('never treats the provisioning database as a private project', () => {
    const url = 'https://bezcwdmaipsqzqgvlfjs.supabase.co'
    expect(controlPlaneProjectRef(url)).toBe('bezcwdmaipsqzqgvlfjs')
    expect(isControlPlaneProject('bezcwdmaipsqzqgvlfjs', url)).toBe(true)
    expect(isControlPlaneProject('abcdefghijklmnopqrst', url)).toBe(false)
    expect(controlPlaneProjectRef('https://example.com')).toBeNull()
  })
})
