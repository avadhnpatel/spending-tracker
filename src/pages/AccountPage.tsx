import { useEffect, useState, type FormEvent } from 'react'
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
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [app, setApp] = useState<PrivateApp | null>(null)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    async function load() {
      const session = await directorySession()
      if (!session) return setSessionReady(true)
      setEmail(session.user.email ?? '')
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

  async function requestLink(event: FormEvent) {
    event.preventDefault()
    if (!directorySupabase) return
    setBusy(true); setMessage('')
    const { error } = await directorySupabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: directoryCallbackUrl(), shouldCreateUser: true } })
    setBusy(false)
    setMessage(error ? error.message : 'Check your email for a secure sign-in link.')
  }

  async function startSetup() {
    const session = await directorySession()
    if (!session) return
    setBusy(true); setMessage('')
    try {
      if (isNativePlatform()) {
        await startPrivateSetup(session.access_token)
        return
      }
      await directoryRequest('/api/directory/start-setup', session.access_token, { method: 'POST' })
      navigate('/setup')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start private setup')
    } finally { setBusy(false) }
  }

  async function openExistingApp() {
    if (!app) return
    if (isNativePlatform()) {
      await saveRuntimeSupabaseConfig({ url: `https://${app.supabase_project_ref}.supabase.co`, publishableKey: app.supabase_publishable_key, deploymentUrl: app.deployment_url })
      window.location.replace('/login')
      return
    }
    window.location.assign(app.deployment_url)
  }

  if (!directorySupabase) return <GatewayShell><p className="text-red-700">This gateway is not configured yet. Add the directory Supabase URL and publishable key to this deployment.</p></GatewayShell>
  if (!sessionReady) return <GatewayShell><p className="text-stone-500">Loading your account…</p></GatewayShell>
  if (!email || !app) return (
    <GatewayShell>
      <p className="mt-3 text-stone-600">Sign in to open an existing private tracker or create one that you own.</p>
      <p className="mt-2 text-sm leading-6 text-stone-500">We’ll email a secure Spend link. It returns you here — you do not need a Vercel account.</p>
      <form onSubmit={requestLink} className="mt-7 space-y-3">
        <input required type="email" autoComplete="email" placeholder="you@email.com" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3.5 outline-none focus:border-teal-700" />
        <button disabled={busy} className="min-h-12 w-full rounded-2xl bg-teal-800 px-5 font-semibold text-white disabled:opacity-60">{busy ? 'Sending…' : 'Continue with email'}</button>
      </form>
      {email && sessionReady ? <button type="button" onClick={() => void startSetup()} disabled={busy} className="mt-5 min-h-12 w-full rounded-2xl border border-teal-800 px-5 font-semibold text-teal-900 disabled:opacity-60">Create my private Spending Tracker</button> : null}
      {message ? <p className="mt-3 text-sm text-teal-800">{message}</p> : null}
    </GatewayShell>
  )
  return <GatewayShell><p className="mt-3 text-stone-600">Your private tracker is ready.</p><button type="button" onClick={() => void openExistingApp()} className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-teal-800 px-5 font-semibold text-white">Open my Spending Tracker →</button></GatewayShell>
}

function GatewayShell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6"><p className="text-sm font-semibold uppercase tracking-wide text-teal-800">Spend</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Your money, in one place.</h1>{children}</main>
}
