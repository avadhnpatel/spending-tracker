import { useEffect, useState } from 'react'

type SetupSession = {
  id: string
  status: string
  connections: { github: boolean; supabase: boolean; vercel: boolean }
  supabaseProjectRef: string | null
  deploymentUrl: string | null
  mobileHandoff: boolean
  error: string | null
  expiresAt: string
}

type SupabaseOrganization = { id: string; slug: string; name: string }
type SupabaseRegionGroup = 'americas' | 'emea' | 'apac'

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { error?: unknown }
  if (!response.ok) {
    const message = typeof body.error === 'string'
      ? body.error
      : body.error && typeof body.error === 'object' && 'message' in body.error && typeof body.error.message === 'string'
        ? body.error.message
        : 'Setup request failed'
    throw new Error(message)
  }
  return body
}

export function SetupPage() {
  const [session, setSession] = useState<SetupSession | null>(null)
  const [busy, setBusy] = useState(false)
  const [organizations, setOrganizations] = useState<SupabaseOrganization[]>([])
  const [organizationSlug, setOrganizationSlug] = useState('')
  const [projectName, setProjectName] = useState('spend-private')
  const [regionGroup, setRegionGroup] = useState<SupabaseRegionGroup>('americas')
  const [error, setError] = useState<string | null>(() => new URLSearchParams(location.search).get('error'))

  useEffect(() => {
    async function load() {
      try {
        setSession(await readJson<SetupSession>(await fetch('/api/setup/session')))
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not start setup')
      }
    }
    void load()
  }, [])

  useEffect(() => {
    if (session?.status !== 'complete') return
    if (session.mobileHandoff) {
      window.location.assign(`spend://setup/complete?session=${encodeURIComponent(session.id)}`)
    } else {
      window.location.replace('/account')
    }
  }, [session?.id, session?.mobileHandoff, session?.status])

  useEffect(() => {
    if (!session?.connections.supabase) return
    async function loadOptions() {
      try {
        const result = await readJson<{ organizations: SupabaseOrganization[] }>(await fetch('/api/setup/options'))
        setOrganizations(result.organizations)
        setOrganizationSlug((current) => current || result.organizations[0]?.slug || '')
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not load Supabase organizations')
      }
    }
    void loadOptions()
  }, [session?.connections.supabase])

  async function provision() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/setup/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationSlug, projectName, regionGroup }),
      })
      const next = await readJson<SetupSession>(response)
      setSession(next)
      if (response.status === 202) {
        window.setTimeout(() => void provision(), 4000)
        return
      }
      setBusy(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Provisioning could not continue')
      setBusy(false)
    }
  }

  const connected = Boolean(session?.connections.supabase)

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-4 pb-16 pt-[max(2rem,env(safe-area-inset-top))] sm:px-6">
      <header className="mb-7">
        <a href="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-800">← Back to Spend</a>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.28em] text-teal-700">Private Spend setup</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Your data, in a project you own.</h1>
        <p className="mt-3 max-w-xl leading-7 text-stone-500">Connect Supabase once. Spend creates your private database and sign-in system, while the app continues to run securely at spendingtrkr.com.</p>
      </header>

      <section className="mb-5 rounded-3xl bg-stone-900 p-5 text-white shadow-xl shadow-stone-900/10">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">Setup progress</span>
          <span className="text-stone-300">{connected ? 1 : 0} of 1</span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-stone-700" aria-label={`${connected ? 1 : 0} of 1 setup steps complete`}>
          <span className={`block h-full rounded-full ${connected ? 'w-full bg-teal-400' : 'w-0'}`} />
        </div>
        <p className="mt-3 text-sm text-stone-300">Your temporary Supabase access token is encrypted and removed when setup finishes.</p>
      </section>

      {error ? <div className="mb-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</div> : null}
      {!session && !error ? <div className="rounded-3xl bg-white p-6 text-stone-500 shadow-sm">Preparing secure setup…</div> : null}

      {session ? (
        <div className="space-y-3">
          <SetupStep title="Connect Supabase" description="Supabase holds your private financial data and authentication. Spend receives temporary permission only to create and configure your project." done={connected}>
            {connected ? <Status text="Supabase connected" /> : <ConnectButton href="/api/setup/oauth/supabase/start" label="Connect Supabase" />}
          </SetupStep>

          {connected && session.status !== 'complete' ? (
            <section className="rounded-3xl border border-teal-200 bg-teal-50 p-5">
              <p className="font-semibold text-teal-950">Create your private Spend database</p>
              <p className="mt-1 text-sm leading-6 text-teal-900">Choose its location. Setup is resumable and usually takes a few minutes.</p>
              <div className="mt-4 space-y-3">
                <label className="block text-sm font-semibold text-teal-950">Supabase organization
                  <select value={organizationSlug} onChange={(event) => setOrganizationSlug(event.target.value)} disabled={busy || Boolean(session.supabaseProjectRef)} className="mt-1 min-h-12 w-full rounded-xl border border-teal-200 bg-white px-3 text-stone-900 disabled:opacity-60">
                    {organizations.map((organization) => <option key={organization.id} value={organization.slug}>{organization.name}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-semibold text-teal-950">Project name
                  <input value={projectName} onChange={(event) => setProjectName(event.target.value)} disabled={busy || Boolean(session.supabaseProjectRef)} className="mt-1 min-h-12 w-full rounded-xl border border-teal-200 bg-white px-3 text-stone-900 disabled:opacity-60" />
                </label>
                <label className="block text-sm font-semibold text-teal-950">Database region
                  <select value={regionGroup} onChange={(event) => setRegionGroup(event.target.value as SupabaseRegionGroup)} disabled={busy || Boolean(session.supabaseProjectRef)} className="mt-1 min-h-12 w-full rounded-xl border border-teal-200 bg-white px-3 text-stone-900 disabled:opacity-60">
                    <option value="americas">Americas</option>
                    <option value="emea">Europe, Middle East, and Africa</option>
                    <option value="apac">Asia Pacific</option>
                  </select>
                </label>
                <button type="button" onClick={() => void provision()} disabled={busy || !organizationSlug} className="min-h-12 w-full rounded-xl bg-teal-800 px-5 font-semibold text-white disabled:opacity-50">{busy ? setupStatusLabel(session.status) : session.supabaseProjectRef ? 'Resume setup' : 'Create my private app'}</button>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      <p className="mt-7 text-center text-xs leading-5 text-stone-500">Your financial data stays in the Supabase project you own. Plaid is connected later inside Spend.</p>
    </main>
  )
}

function setupStatusLabel(status: string): string {
  if (status === 'connecting' || status === 'ready_to_provision' || status === 'creating_supabase') return 'Creating Supabase project…'
  if (status === 'applying_schema' || status === 'configuring_supabase') return 'Configuring database…'
  if (status.startsWith('deploying_plaid')) return 'Installing secure functions…'
  if (status === 'reading_supabase_key' || status === 'configuring_auth') return 'Finishing setup…'
  return 'Working…'
}

function SetupStep({ title, description, done, children }: { title: string; description: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="flex gap-4">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-bold ${done ? 'bg-teal-700 text-white' : 'bg-stone-100 text-stone-500'}`}>{done ? '✓' : '1'}</span>
        <div className="min-w-0 flex-1"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-stone-500">{description}</p><div className="mt-4">{children}</div></div>
      </div>
    </section>
  )
}

function ConnectButton({ href, label }: { href: string; label: string }) {
  return <a href={href} className="inline-flex min-h-12 items-center rounded-xl bg-stone-900 px-5 font-semibold text-white">{label} →</a>
}

function Status({ text }: { text: string }) {
  return <div className="flex min-h-12 items-center gap-2 rounded-xl bg-teal-50 px-4 text-sm font-semibold text-teal-900"><span aria-hidden>✓</span><span className="truncate">{text}</span></div>
}
