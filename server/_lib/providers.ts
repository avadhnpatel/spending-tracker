import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { decryptSecret } from './crypto.js'
import { supabaseProjectBody, type SupabaseRegionGroup } from './supabase-project.js'
import type { SetupSession } from './types.js'

type ProviderError = { message?: string; error?: string; error_description?: string }

async function providerRequest<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const text = await response.text()
  let body: T & ProviderError
  try { body = (text ? JSON.parse(text) : {}) as T & ProviderError } catch { body = {} as T & ProviderError }
  if (!response.ok) throw new Error(body.message || body.error_description || body.error || `Provider request failed (${response.status})`)
  return body
}

function supabaseToken(session: SetupSession): string {
  if (!session.supabase_token_encrypted) throw new Error('Reconnect Supabase to continue')
  return decryptSecret(session.supabase_token_encrypted)
}

function vercelToken(session: SetupSession): string {
  if (!session.vercel_token_encrypted) throw new Error('Reconnect Vercel to continue')
  return decryptSecret(session.vercel_token_encrypted)
}

function githubToken(session: SetupSession): string {
  if (!session.github_token_encrypted) throw new Error('Reconnect GitHub to continue')
  return decryptSecret(session.github_token_encrypted)
}

export type SupabaseOrganization = { id: string; slug: string; name: string }

export async function listSupabaseOrganizations(session: SetupSession): Promise<SupabaseOrganization[]> {
  return providerRequest('https://api.supabase.com/v1/organizations', {
    headers: { Authorization: `Bearer ${supabaseToken(session)}` },
  })
}

export async function createSupabaseProject(session: SetupSession, organizationSlug: string, name: string, regionGroup: SupabaseRegionGroup) {
  const dbPass = `${crypto.randomUUID()}Aa1!`
  return providerRequest<{ ref: string; name: string }>('https://api.supabase.com/v1/projects', {
    method: 'POST',
    headers: { Authorization: `Bearer ${supabaseToken(session)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(supabaseProjectBody(organizationSlug, name, dbPass, regionGroup)),
  })
}

export async function applySpendSchema(session: SetupSession): Promise<void> {
  if (!session.supabase_project_ref) throw new Error('Supabase project is missing')
  const query = await readFile(join(process.cwd(), 'supabase/schema.sql'), 'utf8')
  await providerRequest(`https://api.supabase.com/v1/projects/${session.supabase_project_ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${supabaseToken(session)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, read_only: false }),
  })
}

export async function getSupabasePublishableKey(session: SetupSession): Promise<string> {
  if (!session.supabase_project_ref) throw new Error('Supabase project is missing')
  const keys = await providerRequest<Array<{ type?: string; name?: string; api_key?: string }>>(
    `https://api.supabase.com/v1/projects/${session.supabase_project_ref}/api-keys?reveal=true`,
    { headers: { Authorization: `Bearer ${supabaseToken(session)}` } },
  )
  const key = keys.find((item) => item.type === 'publishable' || item.name === 'anon')?.api_key
  if (!key) throw new Error('Supabase has not finished generating the publishable key')
  return key
}

const functionSlugs = ['plaid-link-token', 'plaid-exchange', 'plaid-sync'] as const

export async function deploySpendFunctions(session: SetupSession): Promise<void> {
  if (!session.supabase_project_ref) throw new Error('Supabase project is missing')
  const sharedFiles = ['http.ts', 'plaid.ts', 'supabase.ts']
  for (const slug of functionSlugs) {
    const form = new FormData()
    form.append('metadata', JSON.stringify({ entrypoint_path: `${slug}/index.ts`, name: slug, verify_jwt: true }))
    form.append('file', new Blob([await readFile(join(process.cwd(), `supabase/functions/${slug}/index.ts`))]), `${slug}/index.ts`)
    for (const filename of sharedFiles) {
      form.append('file', new Blob([await readFile(join(process.cwd(), `supabase/functions/_shared/${filename}`))]), `_shared/${filename}`)
    }
    await providerRequest(`https://api.supabase.com/v1/projects/${session.supabase_project_ref}/functions/deploy?slug=${slug}`, {
      method: 'POST', headers: { Authorization: `Bearer ${supabaseToken(session)}` }, body: form,
    })
  }
}

export async function configureSupabaseAuth(session: SetupSession, siteUrl: string, deploymentUrl?: string): Promise<void> {
  if (!session.supabase_project_ref) throw new Error('Supabase project is missing')
  const baseUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`
  const redirects = [`${baseUrl}/auth/callback`, 'spend://auth/callback']
  if (deploymentUrl && deploymentUrl !== baseUrl) redirects.push(`${deploymentUrl}/auth/callback`)
  await providerRequest(`https://api.supabase.com/v1/projects/${session.supabase_project_ref}/config/auth`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${supabaseToken(session)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ site_url: baseUrl, uri_allow_list: redirects.join(','), disable_signup: false, external_email_enabled: true }),
  })
}

export async function githubRepository(session: SetupSession) {
  if (!session.repository_full_name) throw new Error('GitHub repository is missing')
  return providerRequest<{ id: number; default_branch: string }>(`https://api.github.com/repos/${session.repository_full_name}`, {
    headers: { Authorization: `Bearer ${githubToken(session)}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  })
}

function teamQuery(session: SetupSession): string {
  return session.vercel_team_id ? `?teamId=${encodeURIComponent(session.vercel_team_id)}` : ''
}

export async function createVercelProject(session: SetupSession, publishableKey: string) {
  if (!session.repository_full_name || !session.supabase_project_ref) throw new Error('Provisioning details are incomplete')
  const projectName = session.repository_full_name.split('/')[1]!.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 90)
  const targets = ['production', 'preview', 'development']
  const variables = [
    ['VITE_SUPABASE_URL', `https://${session.supabase_project_ref}.supabase.co`],
    ['VITE_SUPABASE_PUBLISHABLE_KEY', publishableKey],
  ].flatMap(([key, value]) => targets.map((target) => ({ key, value, target, type: 'encrypted' })))
  return providerRequest<{ id: string; name: string }>(`https://api.vercel.com/v11/projects${teamQuery(session)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${vercelToken(session)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: projectName, framework: 'vite', gitRepository: { type: 'github', repo: session.repository_full_name }, environmentVariables: variables }),
  })
}

/**
 * A Spend deployment is a public web shell. Authentication is handled by the
 * private Supabase project that backs it, so Vercel Authentication would only
 * put an unrelated Vercel sign-in screen in front of the app (and prevents
 * magic-link callbacks from reaching it).
 *
 * Teams can apply Vercel Authentication as the default for every new project.
 * Clear that inherited setting for the project created by the installer.
 */
export async function disableVercelAuthentication(session: SetupSession): Promise<void> {
  if (!session.vercel_project_id) throw new Error('Vercel project is missing')
  await providerRequest(`https://api.vercel.com/v9/projects/${encodeURIComponent(session.vercel_project_id)}${teamQuery(session)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${vercelToken(session)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ssoProtection: null }),
  })
}

export async function createVercelDeployment(session: SetupSession) {
  if (!session.vercel_project_id || !session.repository_full_name) throw new Error('Vercel project is missing')
  const repository = await githubRepository(session)
  const name = session.repository_full_name.split('/')[1]!
  return providerRequest<{ id: string; url: string; readyState?: string }>(`https://api.vercel.com/v13/deployments${teamQuery(session)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${vercelToken(session)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, project: session.vercel_project_id, target: 'production', gitSource: { type: 'github', repoId: repository.id, ref: repository.default_branch || 'main' } }),
  })
}
