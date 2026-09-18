import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { directoryCallbackUrl, directorySession, directorySupabase } from '../lib/directory'
import { startPrivateSetup } from '../lib/mobile-onboarding'
import { isNativePlatform } from '../lib/platform'
import { saveRuntimeSupabaseConfig } from '../lib/runtime-config'

type PrivateApp = { deployment_url: string; supabase_project_ref: string; supabase_publishable_key: string }

async function directoryRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  const body = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(body.error || 'Account request failed')
  return body
}

export function AccountPage() {
  const navigate = useNavigate()
  const recoveryRequested = new URLSearchParams(location.search).get('recover') === '1'
  const plaidSetup = new URLSearchParams(location.search).get('plaid') === 'connected'
  const plaidRequested = plaidSetup || new URLSearchParams(location.search).get('plaid') === '1'
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [app, setApp] = useState<PrivateApp | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [directoryAccessToken, setDirectoryAccessToken] = useState<string | null>(null)
  const [plaidClientId, setPlaidClientId] = useState('')
  const [plaidSecret, setPlaidSecret] = useState('')
  const [plaidEnvironment, setPlaidEnvironment] = useState<'sandbox' | 'development' | 'production'>('production')
  const appOpened = useRef(false)

  useEffect(() => {
    async function load() {
      const session = await directorySession()
      if (!session) return setSessionReady(true)
      setEmail(session.user.email ?? '')
      setDirectoryAccessToken(session.access_token)
      try {
        const result = await directoryRequest<{ app: PrivateApp | null }>('/api/directory/me', session.access_token)
        setApp(result.app)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Could not find your private app')
      } finally {
        setSessionReady(true)
      }
    }
    void load()
  }, [])

  useEffect(() => {
    if (!app || recoveryRequested || plaidRequested || appOpened.current) return
    appOpened.current = true
    void saveRuntimeSupabaseConfig({
      url: `https://${app.supabase_project_ref}.supabase.co`,
      publishableKey: app.supabase_publishable_key,
      deploymentUrl: app.deployment_url,
    }).then(() => window.location.replace('/login')).catch((error: unknown) => {
      appOpened.current = false
      setMessage(error instanceof Error ? error.message : 'Could not open your private tracker')
    })
  }, [app, plaidRequested, recoveryRequested])

  async function requestLink(event: FormEvent) {
    event.preventDefault()
    if (!directorySupabase) return
    setBusy(true); setMessage('')
    const { error } = await directorySupabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: directoryCallbackUrl(), shouldCreateUser: true } })
    setBusy(false)
    setMessage(error ? error.message : 'Check your email for a secure sign-in link.')
  }

  async function startSetupManually(replace = false) {
    if (!directoryAccessToken) return
    setBusy(true)
    setMessage('Starting your private setup…')
    try {
      if (isNativePlatform()) {
        await startPrivateSetup(directoryAccessToken)
        return
      }
      await directoryRequest('/api/directory/start-setup', directoryAccessToken, {
        method: 'POST',
        body: JSON.stringify(replace ? { replace: true } : {}),
      })
      navigate('/setup')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start private setup')
    } finally {
      setBusy(false)
    }
  }

  async function recoverExistingProject() {
    if (!directoryAccessToken) return
    setBusy(true)
    setMessage('Preparing recovery…')
    try {
      await directoryRequest('/api/directory/recover', directoryAccessToken, { method: 'POST' })
      navigate('/setup')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start project recovery')
    } finally {
      setBusy(false)
    }
  }

  async function changeDirectoryEmail() {
    if (!directorySupabase) return
    setBusy(true)
    const { error } = await directorySupabase.auth.signOut()
    if (error) {
      setMessage(error.message)
      setBusy(false)
      return
    }
    window.location.replace('/account')
  }

  async function beginPlaidSetup() {
    if (!directoryAccessToken) return
    setBusy(true); setMessage('Connecting to Supabase…')
    try {
      await directoryRequest('/api/directory/plaid', directoryAccessToken, { method: 'POST' })
      window.location.assign('/api/setup/oauth/supabase/start')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start Plaid setup')
      setBusy(false)
    }
  }

  async function savePlaidSetup(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setMessage('Verifying and securing your Plaid credentials…')
    try {
      await directoryRequest('/api/setup/plaid/configure', directoryAccessToken ?? '', {
        method: 'POST',
        body: JSON.stringify({ clientId: plaidClientId, secret: plaidSecret, environment: plaidEnvironment }),
      })
      setPlaidClientId(''); setPlaidSecret('')
      setMessage('Plaid is enabled for your private tracker. You can now connect a bank.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save Plaid setup')
    } finally {
      setBusy(false)
    }
  }

  if (!directorySupabase) return <GatewayShell><p className="text-red-700">This gateway is not configured yet. Add the directory Supabase URL and publishable key to this deployment.</p></GatewayShell>
  if (!sessionReady) return <GatewayShell><p className="text-stone-500">Loading your account…</p></GatewayShell>
  if (!directoryAccessToken) return (
    <GatewayShell>
      <p className="mt-3 text-stone-600">Create and own your private Spending Tracker.</p>
      <p className="mt-2 text-sm leading-6 text-stone-500">We’ll verify your email, then help you create a private Supabase project that you own. No GitHub or Vercel account is required.</p>
      <form onSubmit={requestLink} className="mt-7 space-y-3">
        <input required type="email" autoComplete="email" placeholder="you@email.com" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3.5 outline-none focus:border-teal-700" />
        <button disabled={busy} className="min-h-12 w-full rounded-2xl bg-teal-800 px-5 font-semibold text-white disabled:opacity-60">{busy ? 'Sending…' : 'Continue with email'}</button>
      </form>
      {message ? <p className="mt-3 text-sm text-teal-800">{message}</p> : null}
    </GatewayShell>
  )
  if (app && plaidSetup) return (
    <GatewayShell>
      <p className="mt-3 text-stone-600">Enable bank sync with your own Plaid account.</p>
      <p className="mt-2 text-sm leading-6 text-stone-500">Your credentials are checked once, then written directly to your private Supabase Edge Function secrets. Spend never stores them. In your Plaid Dashboard, add <span className="font-medium text-stone-700">https://spendingtrkr.com/import</span> as an allowed redirect URI.</p>
      <form onSubmit={savePlaidSetup} className="mt-6 space-y-3">
        <label className="block text-sm font-medium text-stone-700">Plaid environment<select value={plaidEnvironment} onChange={(event) => setPlaidEnvironment(event.target.value as typeof plaidEnvironment)} className="mt-1 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3.5 outline-none focus:border-teal-700"><option value="production">Production</option><option value="development">Development</option><option value="sandbox">Sandbox</option></select></label>
        <label className="block text-sm font-medium text-stone-700">Client ID<input required autoCapitalize="none" autoComplete="off" value={plaidClientId} onChange={(event) => setPlaidClientId(event.target.value)} className="mt-1 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3.5 outline-none focus:border-teal-700" /></label>
        <label className="block text-sm font-medium text-stone-700">Secret<input required type="password" autoComplete="new-password" value={plaidSecret} onChange={(event) => setPlaidSecret(event.target.value)} className="mt-1 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3.5 outline-none focus:border-teal-700" /></label>
        <button disabled={busy} className="min-h-12 w-full rounded-2xl bg-teal-800 px-5 font-semibold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Verify and enable Plaid'}</button>
      </form>
      <button type="button" onClick={() => window.location.replace('/account')} disabled={busy} className="mt-3 min-h-12 w-full rounded-2xl border border-stone-300 px-5 font-semibold text-stone-700 disabled:opacity-60">Cancel</button>
      {message ? <p className="mt-5 text-sm text-teal-800">{message}</p> : null}
    </GatewayShell>
  )
  if (app && plaidRequested) return (
    <GatewayShell>
      <p className="mt-3 text-stone-600">Enable automatic bank sync.</p>
      <p className="mt-2 text-sm leading-6 text-stone-500">Use your own Plaid account. We’ll briefly reconnect to Supabase so the credentials can be stored only in your private project’s Edge Function secrets.</p>
      <button type="button" onClick={() => void beginPlaidSetup()} disabled={busy} className="mt-6 min-h-12 w-full rounded-2xl bg-teal-800 px-5 font-semibold text-white disabled:opacity-60">{busy ? 'Connecting…' : 'Continue with Supabase'}</button>
      <button type="button" onClick={() => window.location.replace('/account')} disabled={busy} className="mt-3 min-h-12 w-full rounded-2xl border border-stone-300 px-5 font-semibold text-stone-700 disabled:opacity-60">Cancel</button>
      {message ? <p className="mt-5 text-sm text-teal-800">{message}</p> : null}
    </GatewayShell>
  )
  if (app && recoveryRequested) return <GatewayShell><p className="mt-3 text-stone-600">Reconnect {email || 'this account'} to the Supabase project that contains your existing Spend data.</p><p className="mt-2 text-sm leading-6 text-stone-500">Choose an existing project to recover it, or intentionally replace the current link with a new private database.</p><button type="button" onClick={() => void recoverExistingProject()} disabled={busy} className="mt-6 min-h-12 w-full rounded-2xl bg-teal-800 px-5 font-semibold text-white disabled:opacity-60">Choose an existing Supabase project</button><button type="button" onClick={() => void startSetupManually(true)} disabled={busy} className="mt-3 min-h-12 w-full rounded-2xl border border-teal-800 px-5 font-semibold text-teal-900 disabled:opacity-60">Create a new private database</button><button type="button" onClick={() => window.location.replace('/account')} disabled={busy} className="mt-3 min-h-12 w-full rounded-2xl border border-stone-300 px-5 font-semibold text-stone-700 disabled:opacity-60">Keep using the current project</button>{message ? <p className="mt-5 text-sm text-teal-800">{message}</p> : null}</GatewayShell>
  if (!app) return <GatewayShell><p className="mt-3 text-stone-600">No private database is linked to {email || 'this email'}.</p><p className="mt-2 text-sm leading-6 text-stone-500">If you already own a Spend project, recover it without creating anything. Otherwise, create a new private database.</p><button type="button" onClick={() => void recoverExistingProject()} disabled={busy} className="mt-6 min-h-12 w-full rounded-2xl bg-teal-800 px-5 font-semibold text-white disabled:opacity-60">Recover my existing database</button><button type="button" onClick={() => void startSetupManually()} disabled={busy} className="mt-3 min-h-12 w-full rounded-2xl border border-teal-800 px-5 font-semibold text-teal-900 disabled:opacity-60">Set up a new private database</button><button type="button" onClick={() => void changeDirectoryEmail()} disabled={busy} className="mt-3 min-h-12 w-full rounded-2xl border border-stone-300 px-5 font-semibold text-stone-700 disabled:opacity-60">Use a different email</button>{message ? <p className="mt-5 text-sm text-teal-800">{message}</p> : null}</GatewayShell>
  return <GatewayShell><p className="mt-3 text-stone-600">Opening your private tracker…</p><button type="button" onClick={() => void beginPlaidSetup()} disabled={busy} className="mt-6 min-h-12 w-full rounded-2xl border border-teal-800 px-5 font-semibold text-teal-900 disabled:opacity-60">Enable Plaid bank sync</button>{message ? <p className="mt-5 text-sm text-red-700">{message}</p> : null}</GatewayShell>
}

function GatewayShell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6"><p className="text-sm font-semibold uppercase tracking-wide text-teal-800">Spend</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Your money, in one place.</h1>{children}</main>
}
