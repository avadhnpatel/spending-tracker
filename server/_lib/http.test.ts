import { afterEach, describe, expect, it, vi } from 'vitest'
import { setSessionCookie, setupBaseUrl } from './http'
import type { ApiResponse } from './types'

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

  it('shares the setup cookie between the apex and www hosts', () => {
    process.env.SETUP_BASE_URL = 'https://spendingtrkr.com'
    const setHeader = vi.fn()
    setSessionCookie({ setHeader } as unknown as ApiResponse, 'session.secret')
    expect(setHeader).toHaveBeenCalledWith('Set-Cookie', expect.stringContaining('Domain=spendingtrkr.com'))
  })
})
