import { setupBaseUrl } from './http.js'

export const GITHUB_OAUTH_SCOPE = 'repo'

export function githubOAuthConfig(): { clientId: string; clientSecret: string; callbackUrl: string } {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('GitHub OAuth is not configured')
  return {
    clientId,
    clientSecret,
    callbackUrl: `${setupBaseUrl()}/api/setup/oauth/github/callback`,
  }
}

export function githubAuthorizationUrl(state: string): string {
  const { clientId, callbackUrl } = githubOAuthConfig()
  const url = new URL('https://github.com/login/oauth/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', callbackUrl)
  url.searchParams.set('scope', GITHUB_OAUTH_SCOPE)
  url.searchParams.set('state', state)
  return url.toString()
}

export function hasRequiredGitHubScope(scope: string | undefined): boolean {
  return (scope ?? '').split(',').map((value) => value.trim()).includes(GITHUB_OAUTH_SCOPE)
}
