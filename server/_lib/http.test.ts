import { afterEach, describe, expect, it } from 'vitest'
import { setupBaseUrl } from './http'

const originalSetupBaseUrl = process.env.SETUP_BASE_URL

afterEach(() => {
  if (originalSetupBaseUrl === undefined) delete process.env.SETUP_BASE_URL
  else process.env.SETUP_BASE_URL = originalSetupBaseUrl
})

describe('setupBaseUrl', () => {
  it('uses the configured public domain as the OAuth callback origin', () => {
    process.env.SETUP_BASE_URL = 'https://spendingtrkr.com/'
    expect(setupBaseUrl()).toBe('https://spendingtrkr.com')
  })

  it('rejects Vercel deployment URLs as OAuth callback origins', () => {
    process.env.SETUP_BASE_URL = 'https://spending-tracker-avadhnpatels-projects.vercel.app'
    expect(() => setupBaseUrl()).toThrow('public Spend domain')
  })
})
