import { useEffect, useMemo, useState } from 'react'

type SetupSession = {
  id: string
  status: string
  connections: { github: boolean; supabase: boolean; vercel: boolean }
  githubLogin: string | null
  repository: string | null
  supabaseProjectRef: string | null
  vercelProjectId: string | null
  deploymentUrl: string | null
  error: string | null
  expiresAt: string
}

type SupabaseOrganization = { id: string; slug: string; name: string }

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(body.error || 'Setup request failed')
  return body
}

export function SetupPage() {
  const [session, setSession] = useState<SetupSession | null>(null)
  const [repositoryName, setRepositoryName] = useState('spend-private')
  const [busy, setBusy] = useState(false)
  const [organizations, setOrganizations] = useState<SupabaseOrganization[]>([])
  const [organizationSlug, setOrganizationSlug] = useState('')
  const [projectName, setProjectName] = useState('spend-private')
  const [error, setError] = useState<string | null>(() => new URLSearchParams(location.search).get('error'))

  useEffect(() => {
    async function load() {
      try {
        let response = await fetch('/api/setup/session')
        if (response.status === 404) response = await fetch('/api/setup/session', { method: 'POST' })
        setSession(await readJson<SetupSession>(response))
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not start setup')
      }
    }
    void load()
  }, [])

  const completed = useMemo(() => {
    if (!session) return 0
    return Number(session.connections.github) + Number(Boolean(session.repository)) + Number(session.connections.supabase) + Number(session.connections.vercel)
  }, [session])

  useEffect(() => {
    if (completed !== 4 || session?.status === 'complete') return
    async function loadOptions() {
      try {
        const result = await readJson<{ organizations: SupabaseOrganization[] }>(await fetch('/api/setup/options'))
        setOrganizations(result.organizations)
        setOrganizationSlug((current) => current || result.organizations[0]?.slug || '')
        if (session?.repository) setProjectName(session.repository.split('/')[1] || 'spend-private')
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not load Supabase organizations')
      }
    }
    void loadOptions()
  }, [completed, session?.repository, session?.status])

  async function createRepository() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/setup/github/repository', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: repositoryName, private: true }),
      })
      setSession(await readJson<SetupSession>(response))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the repository')
    } finally {
      setBusy(false)
    }
  }

  async function provision() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/setup/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationSlug, projectName }),
      })
      const next = await readJson<SetupSession>(response)
      setSession(next)
      if (response.status === 202) {
        window.setTimeout(() => void provision(), next.status === 'configuring_supabase' ? 15000 : 4000)
        return
      }
      setBusy(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Provisioning could not continue')
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-4 pb-16 pt-[max(2rem,env(safe-area-inset-top))] sm:px-6">
      <header className="mb-7">
        <a href="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-800">← Back to Spend</a>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.28em] text-teal-700">Private Spend setup</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Your own app, without the technical setup.</h1>
        <p className="mt-3 max-w-xl leading-7 text-stone-500">Connect three free services. Spend creates a private copy with its own database, deployment, and data limits.</p>
      </header>

      <section className="mb-5 rounded-3xl bg-stone-900 p-5 text-white shadow-xl shadow-stone-900/10">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">Setup progress</span>
          <span className="text-stone-300">{completed} of 4</span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2" aria-label={`${completed} of 4 setup steps complete`}>
          {[0, 1, 2, 3].map((step) => <span key={step} className={`h-2 rounded-full ${step < completed ? 'bg-teal-400' : 'bg-stone-700'}`} />)}
        </div>
        <p className="mt-3 text-sm text-stone-300">This session expires in two hours. Access tokens are encrypted and removed after provisioning.</p>
      </section>

      {error ? <div className="mb-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</div> : null}
      {!session && !error ? <div className="rounded-3xl bg-white p-6 text-stone-500 shadow-sm">Preparing secure setup…</div> : null}

      {session ? (
        <div className="space-y-3">
          <SetupStep number="1" title="Connect GitHub" description="GitHub holds your private copy of the app." done={session.connections.github}>
            {session.connections.github ? <Status text={`Connected as ${session.githubLogin}`} /> : <ConnectButton href="/api/setup/oauth/github/start" label="Connect GitHub" />}
          </SetupStep>

          <SetupStep number="2" title="Create your private repository" description="We copy the Spend template into a new private repository that you own." done={Boolean(session.repository)} locked={!session.connections.github}>
            {session.repository ? <Status text={session.repository} /> : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="sr-only" htmlFor="repository-name">Repository name</label>
                <input id="repository-name" value={repositoryName} onChange={(event) => setRepositoryName(event.target.value)} disabled={!session.connections.github || busy} className="min-h-12 min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-4 text-base disabled:opacity-50" autoCapitalize="none" spellCheck={false} />
                <button type="button" onClick={() => void createRepository()} disabled={!session.connections.github || busy || !repositoryName.trim()} className="min-h-12 rounded-xl bg-teal-800 px-5 font-semibold text-white disabled:opacity-40">{busy ? 'Creating…' : 'Create private repo'}</button>
              </div>
            )}
          </SetupStep>

          <SetupStep number="3" title="Connect Supabase" description="Supabase provides your private database and sign-in system." done={session.connections.supabase} locked={!session.repository}>
            {session.connections.supabase ? <Status text="Supabase connected" /> : <ConnectButton href="/api/setup/oauth/supabase/start" label="Connect Supabase" disabled={!session.repository} />}
          </SetupStep>

          <SetupStep number="4" title="Connect Vercel" description="Vercel publishes your app at a secure web address." done={session.connections.vercel} locked={!session.connections.supabase}>
            {session.connections.vercel ? <Status text="Vercel connected" /> : <ConnectButton href="/api/setup/oauth/vercel/start" label="Connect Vercel" disabled={!session.connections.supabase} />}
          </SetupStep>

          {completed === 4 && session.status !== 'complete' ? (
            <section className="rounded-3xl border border-teal-200 bg-teal-50 p-5">
              <p className="font-semibold text-teal-950">Create your private Spend app</p>
              <p className="mt-1 text-sm leading-6 text-teal-900">Choose where the private database should live. Setup usually takes two to four minutes and can be retried safely.</p>
              <div className="mt-4 space-y-3">
                <label className="block text-sm font-semibold text-teal-950">Supabase organization
                  <select value={organizationSlug} onChange={(event) => setOrganizationSlug(event.target.value)} disabled={busy || Boolean(session.supabaseProjectRef)} className="mt-1 min-h-12 w-full rounded-xl border border-teal-200 bg-white px-3 text-stone-900 disabled:opacity-60">
                    {organizations.map((organization) => <option key={organization.id} value={organization.slug}>{organization.name}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-semibold text-teal-950">Project name
                  <input value={projectName} onChange={(event) => setProjectName(event.target.value)} disabled={busy || Boolean(session.supabaseProjectRef)} className="mt-1 min-h-12 w-full rounded-xl border border-teal-200 bg-white px-3 text-stone-900 disabled:opacity-60" />
                </label>
                <button type="button" onClick={() => void provision()} disabled={busy || !organizationSlug} className="min-h-12 w-full rounded-xl bg-teal-800 px-5 font-semibold text-white disabled:opacity-50">{busy ? setupStatusLabel(session.status) : session.supabaseProjectRef ? 'Resume setup' : 'Create my private app'}</button>
              </div>
            </section>
          ) : null}

          {session.status === 'complete' && session.deploymentUrl ? (
            <section className="rounded-3xl border border-teal-200 bg-teal-50 p-5">
              <p className="font-semibold text-teal-950">Your private Spend app is ready.</p>
              <p className="mt-1 text-sm leading-6 text-teal-900">The temporary provider tokens have been removed from the installer.</p>
              <a href={session.deploymentUrl} className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-teal-800 px-5 font-semibold text-white">Open my Spend app →</a>
            </section>
          ) : null}
        </div>
      ) : null}

      <p className="mt-7 text-center text-xs leading-5 text-stone-500">Your financial data stays in the Supabase project you own. Plaid is connected later inside your deployed Spend app.</p>
    </main>
  )
}

function setupStatusLabel(status: string): string {
  if (status === 'creating_supabase') return 'Creating Supabase project…'
  if (status === 'configuring_supabase') return 'Configuring database…'
  if (status === 'deploying') return 'Deploying to Vercel…'
  return 'Working…'
}

function SetupStep({ number, title, description, done, locked = false, children }: { number: string; title: string; description: string; done: boolean; locked?: boolean; children: React.ReactNode }) {
  return (
    <section className={`rounded-3xl bg-white p-5 shadow-sm transition ${locked ? 'opacity-55' : ''}`}>
      <div className="flex gap-4">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-bold ${done ? 'bg-teal-700 text-white' : 'bg-stone-100 text-stone-500'}`}>{done ? '✓' : number}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-stone-500">{description}</p>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </section>
  )
}

function ConnectButton({ href, label, disabled = false }: { href: string; label: string; disabled?: boolean }) {
  return disabled ? <button type="button" disabled className="min-h-12 rounded-xl bg-stone-100 px-5 font-semibold text-stone-400">{label}</button> : <a href={href} className="inline-flex min-h-12 items-center rounded-xl bg-stone-900 px-5 font-semibold text-white">{label} →</a>
}

function Status({ text }: { text: string }) {
  return <div className="flex min-h-12 items-center gap-2 rounded-xl bg-teal-50 px-4 text-sm font-semibold text-teal-900"><span aria-hidden>✓</span><span className="truncate">{text}</span></div>
}
