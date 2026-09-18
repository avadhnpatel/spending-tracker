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
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [app, setApp] = useState<PrivateApp | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [directoryAccessToken, setDirectoryAccessToken] = useState<string | null>(null)
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
    if (!app || recoveryRequested || appOpened.current) return
    appOpened.current = true
    void saveRuntimeSupabaseConfig({
      url: `https://${app.supabase_project_ref}.supabase.co`,
      publishableKey: app.supabase_publishable_key,
      deploymentUrl: app.deployment_url,
    }).then(() => window.location.replace('/login')).catch((error: unknown) => {
      appOpened.current = false
      setMessage(error instanceof Error ? error.message : 'Could not open your private tracker')
    })
  }, [app, recoveryRequested])

  async function requestLink(event: FormEvent) {
    event.preventDefault()
    if (!directorySupabase) return
    setBusy(true); setMessage('')
    const { error } = await directorySupabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: directoryCallbackUrl(), shouldCreateUser: true } })
    setBusy(false)
    setMessage(error ? error.message : 'Check your email for a secure sign-in link.')
  }

  async function startSetupManually() {
    if (!directoryAccessToken) return
    setBusy(true)
    setMessage('Starting your private setup…')
    try {
      if (isNativePlatform()) {
        await startPrivateSetup(directoryAccessToken)
        return
      }
      await directoryRequest('/api/directory/start-setup', directoryAccessToken, { method: 'POST' })
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
  if (app && recoveryRequested) return <GatewayShell><p className="mt-3 text-stone-600">Reconnect {email || 'this account'} to the Supabase project that contains your existing Spend data.</p><p className="mt-2 text-sm leading-6 text-stone-500">Your current project will not be deleted or changed. The account link is updated only after you choose and successfully configure an existing project.</p><button type="button" onClick={() => void recoverExistingProject()} disabled={busy} className="mt-6 min-h-12 w-full rounded-2xl bg-teal-800 px-5 font-semibold text-white disabled:opacity-60">Choose an existing Supabase project</button><button type="button" onClick={() => window.location.replace('/account')} disabled={busy} className="mt-3 min-h-12 w-full rounded-2xl border border-stone-300 px-5 font-semibold text-stone-700 disabled:opacity-60">Keep using the current project</button>{message ? <p className="mt-5 text-sm text-teal-800">{message}</p> : null}</GatewayShell>
  if (!app) return <GatewayShell><p className="mt-3 text-stone-600">No private database is linked to {email || 'this email'}.</p><p className="mt-2 text-sm leading-6 text-stone-500">If you already own a Spend project, recover it without creating anything. Otherwise, create a new private database.</p><button type="button" onClick={() => void recoverExistingProject()} disabled={busy} className="mt-6 min-h-12 w-full rounded-2xl bg-teal-800 px-5 font-semibold text-white disabled:opacity-60">Recover my existing database</button><button type="button" onClick={() => void startSetupManually()} disabled={busy} className="mt-3 min-h-12 w-full rounded-2xl border border-teal-800 px-5 font-semibold text-teal-900 disabled:opacity-60">Set up a new private database</button><button type="button" onClick={() => void changeDirectoryEmail()} disabled={busy} className="mt-3 min-h-12 w-full rounded-2xl border border-stone-300 px-5 font-semibold text-stone-700 disabled:opacity-60">Use a different email</button>{message ? <p className="mt-5 text-sm text-teal-800">{message}</p> : null}</GatewayShell>
  return <GatewayShell><p className="mt-3 text-stone-600">Opening your private tracker…</p>{message ? <p className="mt-5 text-sm text-red-700">{message}</p> : null}</GatewayShell>
}

function GatewayShell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6"><p className="text-sm font-semibold uppercase tracking-wide text-teal-800">Spend</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Your money, in one place.</h1>{children}</main>
}
