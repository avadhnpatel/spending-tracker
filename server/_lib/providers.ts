import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { decryptSecret } from './crypto.js'
import { isControlPlaneProject, supabaseProjectBody, type SupabaseRegionGroup } from './supabase-project.js'
import type { SetupSession } from './types.js'

type ProviderError = { message?: unknown; error?: unknown; error_description?: unknown; details?: unknown; hint?: unknown }

class ProviderRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ProviderRequestError'
  }
}

function nestedMessage(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (!value || typeof value !== 'object') return null
  if (Array.isArray(value)) {
    const messages = value.map(nestedMessage).filter((message): message is string => Boolean(message))
    return messages.length ? messages.join('; ') : null
  }
  const body = value as ProviderError
  for (const candidate of [body.message, body.error_description, body.details, body.hint, body.error]) {
    const message = nestedMessage(candidate)
    if (message) return message
  }
  return null
}

export function providerErrorMessage(body: unknown, status: number): string {
  return nestedMessage(body) || `Provider request failed (${status})`
}

async function providerRequest<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const text = await response.text()
  let body: T & ProviderError
  try { body = (text ? JSON.parse(text) : {}) as T & ProviderError } catch { body = {} as T & ProviderError }
  if (!response.ok) throw new ProviderRequestError(providerErrorMessage(body, response.status), response.status)
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
export type SupabaseProject = { ref: string; name: string }

export async function listSupabaseOrganizations(session: SetupSession): Promise<SupabaseOrganization[]> {
  return providerRequest('https://api.supabase.com/v1/organizations', {
    headers: { Authorization: `Bearer ${supabaseToken(session)}` },
  })
}

export async function listSupabaseProjects(session: SetupSession): Promise<SupabaseProject[]> {
  return providerRequest<SupabaseProject[]>('https://api.supabase.com/v1/projects', {
    headers: { Authorization: `Bearer ${supabaseToken(session)}` },
  })
}

export async function assertRecoverableSpendProject(session: SetupSession, projectRef: string): Promise<void> {
  if (isControlPlaneProject(projectRef)) throw new Error('The Spend provisioning project cannot be used as a private database')
  const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`
  const headers = { Authorization: `Bearer ${supabaseToken(session)}`, 'Content-Type': 'application/json' }
  const tables = await providerRequest<Array<{ owner_table: string | null }>>(endpoint, {
    method: 'POST', headers, body: JSON.stringify({ query: "select to_regclass('public.spend_owner') as owner_table", read_only: true }),
  })
  if (!tables[0]?.owner_table) throw new Error('That project is not an existing private Spend database')
  const owners = await providerRequest<Array<{ email: string }>>(endpoint, {
    method: 'POST', headers, body: JSON.stringify({ query: 'select email from public.spend_owner where singleton = true', read_only: true }),
  })
  if (!session.directory_email || owners[0]?.email !== session.directory_email.trim().toLowerCase()) {
    throw new Error('That private Spend database belongs to a different email')
  }
}

export async function createSupabaseProject(session: SetupSession, organizationSlug: string, name: string, regionGroup: SupabaseRegionGroup) {
  const projects = await listSupabaseProjects(session)
  const existing = projects.find((project) => project.name === name)
  if (existing) return existing

  const dbPass = `${crypto.randomUUID()}Aa1!`
  try {
    return await providerRequest<{ ref: string; name: string }>('https://api.supabase.com/v1/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${supabaseToken(session)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(supabaseProjectBody(organizationSlug, name, dbPass, regionGroup)),
    })
  } catch (error) {
    const recovered = (await listSupabaseProjects(session)).find((project) => project.name === name)
    if (recovered) return recovered
    throw error
  }
}

export function spendOwnerConfigurationSql(email: string | null): string {
  const normalized = email?.trim().toLowerCase()
  if (!normalized) throw new Error('The private Spend owner email is missing')
  return `select public.configure_spend_owner('${normalized.replaceAll("'", "''")}');`
}

export async function applySpendSchema(session: SetupSession): Promise<void> {
  if (!session.supabase_project_ref) throw new Error('Supabase project is missing')
  if (isControlPlaneProject(session.supabase_project_ref)) throw new Error('The Spend provisioning project cannot be used as a private database')
  const schema = await readFile(join(process.cwd(), 'supabase/schema.sql'), 'utf8')
  const query = `${schema}\n${spendOwnerConfigurationSql(session.directory_email)}`
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

type PlaidEnvironment = 'sandbox' | 'development' | 'production'

function plaidBaseUrl(environment: PlaidEnvironment): string {
  return environment === 'sandbox'
    ? 'https://sandbox.plaid.com'
    : environment === 'development'
      ? 'https://development.plaid.com'
      : 'https://production.plaid.com'
}

/**
 * The credentials are validated before being sent to the user's Supabase
 * project. They are deliberately never stored in the provisioning database.
 */
export async function setPlaidSecrets(session: SetupSession, input: { clientId: string; secret: string; environment: PlaidEnvironment; redirectUri: string }): Promise<void> {
  if (!session.supabase_project_ref || !session.directory_user_id) throw new Error('Your private Supabase project is unavailable')
  const check = await fetch(`${plaidBaseUrl(input.environment)}/link/token/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: input.clientId,
      secret: input.secret,
      client_name: 'Spend setup check',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
      user: { client_user_id: session.directory_user_id },
    }),
  })
  if (!check.ok) {
    const body = await check.json().catch(() => ({})) as { display_message?: string; error_message?: string }
    throw new Error(body.display_message || body.error_message || 'Plaid could not verify those credentials')
  }
  await providerRequest(`https://api.supabase.com/v1/projects/${session.supabase_project_ref}/secrets`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${supabaseToken(session)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      { name: 'PLAID_CLIENT_ID', value: input.clientId },
      { name: 'PLAID_SECRET', value: input.secret },
      { name: 'PLAID_ENV', value: input.environment },
      { name: 'PLAID_REDIRECT_URI', value: input.redirectUri },
    ]),
  })
}

export const spendFunctionSlugs = ['plaid-link-token', 'plaid-exchange', 'plaid-sync'] as const
export type SpendFunctionSlug = typeof spendFunctionSlugs[number]

export async function deploySpendFunction(session: SetupSession, slug: SpendFunctionSlug): Promise<void> {
  if (!session.supabase_project_ref) throw new Error('Supabase project is missing')
  const sharedFiles = ['http.ts', 'plaid.ts', 'supabase.ts']
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

export async function deploySpendFunctions(session: SetupSession): Promise<void> {
  for (const slug of spendFunctionSlugs) {
    await deploySpendFunction(session, slug)
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

type VercelProject = {
  id: string
  name: string
  link?: { org?: string; repo?: string; type?: string } | null
}

function normalizedVercelProjectName(repositoryFullName: string): string {
  return repositoryFullName.split('/')[1]!.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

export function vercelProjectNameCandidates(repositoryFullName: string, sessionId: string): string[] {
  const base = normalizedVercelProjectName(repositoryFullName) || 'spend-private'
  const suffix = sessionId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)
  return suffix
    ? [base, `${base}-${suffix}`, ...Array.from({ length: 4 }, (_, index) => `${base}-${suffix}-${index + 2}`)]
    : [base]
}

function projectLinksRepository(project: VercelProject, repositoryFullName: string): boolean {
  if (!project.link) return false
  const [owner, repo] = repositoryFullName.toLowerCase().split('/')
  const linkedRepo = project.link.repo?.toLowerCase()
  const linkedOwner = project.link.org?.toLowerCase()
  return (!linkedRepo || linkedRepo === repo || linkedRepo === repositoryFullName.toLowerCase())
    && (!linkedOwner || linkedOwner === owner)
}

async function findVercelProject(session: SetupSession, nameOrId: string): Promise<VercelProject | null> {
  try {
    return await providerRequest<VercelProject>(`https://api.vercel.com/v9/projects/${encodeURIComponent(nameOrId)}${teamQuery(session)}`, {
      headers: { Authorization: `Bearer ${vercelToken(session)}` },
    })
  } catch (error) {
    if (error instanceof ProviderRequestError && (error.status === 404 || error.status === 410)) return null
    throw error
  }
}

function recoverableProjectNameError(error: unknown): boolean {
  return error instanceof ProviderRequestError
    && (error.status === 400 || error.status === 409 || error.status === 410)
    && /already exists|has been removed|removed resource/i.test(error.message)
}

export async function createVercelProject(session: SetupSession, publishableKey: string) {
  if (!session.repository_full_name || !session.supabase_project_ref) throw new Error('Provisioning details are incomplete')
  const projectNames = vercelProjectNameCandidates(session.repository_full_name, session.id)
  const targets = ['production', 'preview', 'development']
  const variables = [
    ['VITE_SUPABASE_URL', `https://${session.supabase_project_ref}.supabase.co`],
    ['VITE_SUPABASE_PUBLISHABLE_KEY', publishableKey],
  ].flatMap(([key, value]) => targets.map((target) => ({ key, value, target, type: 'encrypted' })))

  for (const name of projectNames) {
    const existing = await findVercelProject(session, name)
    if (existing && projectLinksRepository(existing, session.repository_full_name)) return existing
  }

  let lastError: unknown
  for (const name of projectNames) {
    try {
      return await providerRequest<VercelProject>(`https://api.vercel.com/v11/projects${teamQuery(session)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${vercelToken(session)}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          framework: 'vite',
          environmentVariables: variables,
          gitRepository: { type: 'github', repo: session.repository_full_name },
        }),
      })
    } catch (error) {
      lastError = error
      if (!recoverableProjectNameError(error)) throw error
      const existing = await findVercelProject(session, name)
      if (existing && projectLinksRepository(existing, session.repository_full_name)) return existing
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not create the Vercel project')
}

export async function linkVercelRepository(session: SetupSession): Promise<VercelProject> {
  if (!session.vercel_project_id || !session.repository_full_name) throw new Error('Vercel project is missing')
  const current = await findVercelProject(session, session.vercel_project_id)
  if (current && projectLinksRepository(current, session.repository_full_name)) return current
  if (!session.supabase_publishable_key) throw new Error('Supabase publishable key is missing')

  // Vercel only accepts gitRepository while creating a project. A project
  // left unlinked by an interrupted/failed create cannot be repaired with the
  // project PATCH endpoint, so resume with the next deterministic project name.
  return createVercelProject(session, session.supabase_publishable_key)
}

export async function createVercelDeployment(session: SetupSession) {
  if (!session.vercel_project_id || !session.repository_full_name) throw new Error('Vercel project is missing')
  const project = await findVercelProject(session, session.vercel_project_id)
  if (!project) throw new Error('The Vercel project is no longer available')
  const repository = await githubRepository(session)
  const deployment = await providerRequest<{ id: string; url: string; readyState?: string }>(`https://api.vercel.com/v13/deployments${teamQuery(session)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${vercelToken(session)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: project.name, project: session.vercel_project_id, target: 'production', gitSource: { type: 'github', repoId: repository.id, ref: repository.default_branch || 'main' } }),
  })
  return { ...deployment, projectName: project.name }
}
