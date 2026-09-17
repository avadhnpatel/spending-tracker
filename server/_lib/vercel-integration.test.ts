import { afterEach, describe, expect, it } from 'vitest'
import { vercelIntegrationUrl } from './vercel-integration'

const originalSlug = process.env.VERCEL_INTEGRATION_SLUG

afterEach(() => {
  if (originalSlug === undefined) delete process.env.VERCEL_INTEGRATION_SLUG
  else process.env.VERCEL_INTEGRATION_SLUG = originalSlug
})

describe('vercelIntegrationUrl', () => {
  it('starts Vercel external installation with CSRF state', () => {
    process.env.VERCEL_INTEGRATION_SLUG = 'spend-private-setup'
    const url = new URL(vercelIntegrationUrl('csrf-state'))
    expect(url.origin + url.pathname).toBe('https://vercel.com/integrations/spend-private-setup/new')
    expect(url.searchParams.get('state')).toBe('csrf-state')
    expect(url.searchParams.has('redirect_uri')).toBe(false)
  })

  it('requires an integration slug', () => {
    delete process.env.VERCEL_INTEGRATION_SLUG
    expect(() => vercelIntegrationUrl('csrf-state')).toThrow('Vercel integration is not configured')
  })
})
