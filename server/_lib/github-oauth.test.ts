import { afterEach, describe, expect, it } from 'vitest'
import { githubAuthorizationUrl, githubOAuthConfig, hasRequiredGitHubScope } from './github-oauth'

const original = {
  baseUrl: process.env.SETUP_BASE_URL,
  clientId: process.env.GITHUB_OAUTH_CLIENT_ID,
  clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
}

afterEach(() => {
  for (const [key, value] of Object.entries({
    SETUP_BASE_URL: original.baseUrl,
    GITHUB_OAUTH_CLIENT_ID: original.clientId,
    GITHUB_OAUTH_CLIENT_SECRET: original.clientSecret,
  })) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('GitHub OAuth', () => {
  it('requests repo access and uses the registered production callback', () => {
    process.env.SETUP_BASE_URL = 'https://spendingtrkr.com'
    process.env.GITHUB_OAUTH_CLIENT_ID = 'oauth-client-id'
    process.env.GITHUB_OAUTH_CLIENT_SECRET = 'oauth-client-secret'

    const url = new URL(githubAuthorizationUrl('csrf-state'))
    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize')
    expect(url.searchParams.get('client_id')).toBe('oauth-client-id')
    expect(url.searchParams.get('redirect_uri')).toBe('https://spendingtrkr.com/api/setup/oauth/github/callback')
    expect(url.searchParams.get('scope')).toBe('repo')
    expect(url.searchParams.get('state')).toBe('csrf-state')
  })

  it('requires OAuth App credentials rather than GitHub App credentials', () => {
    process.env.SETUP_BASE_URL = 'https://spendingtrkr.com'
    delete process.env.GITHUB_OAUTH_CLIENT_ID
    delete process.env.GITHUB_OAUTH_CLIENT_SECRET
    process.env.GITHUB_APP_CLIENT_ID = 'wrong-kind-of-client'
    process.env.GITHUB_APP_CLIENT_SECRET = 'wrong-kind-of-secret'
    expect(() => githubOAuthConfig()).toThrow('GitHub OAuth is not configured')
  })

  it('recognizes repo among the scopes returned by GitHub', () => {
    expect(hasRequiredGitHubScope('read:user, repo, user:email')).toBe(true)
    expect(hasRequiredGitHubScope('public_repo, read:user')).toBe(false)
  })
})
