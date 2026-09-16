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
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [app, setApp] = useState<PrivateApp | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const setupStarted = useRef(false)
  const appOpened = useRef(false)

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

  useEffect(() => {
    if (!sessionReady || !email || app || setupStarted.current) return
    setupStarted.current = true

    async function continuePrivateSetup() {
      const session = await directorySession()
      if (!session) return
      setBusy(true); setMessage('Your email is verified. Starting your private setup…')
      try {
        if (isNativePlatform()) {
          await startPrivateSetup(session.access_token)
          return
        }
        await directoryRequest('/api/directory/start-setup', session.access_token, { method: 'POST' })
        navigate('/setup')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Could not start private setup')
        setupStarted.current = false
      } finally {
        setBusy(false)
      }
    }

    void continuePrivateSetup()
  }, [app, email, navigate, sessionReady])

  useEffect(() => {
    if (!app || appOpened.current) return
    appOpened.current = true
    void openExistingApp().catch((error: unknown) => {
      appOpened.current = false
      setMessage(error instanceof Error ? error.message : 'Could not open your private tracker')
    })
  }, [app])

  async function requestLink(event: FormEvent) {
    event.preventDefault()
    if (!directorySupabase) return
    setBusy(true); setMessage('')
    const { error } = await directorySupabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: directoryCallbackUrl(), shouldCreateUser: true } })
    setBusy(false)
    setMessage(error ? error.message : 'Check your email for a secure sign-in link.')
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
  if (!email) return (
    <GatewayShell>
      <p className="mt-3 text-stone-600">Create and own your private Spending Tracker.</p>
      <p className="mt-2 text-sm leading-6 text-stone-500">We’ll verify your email, then guide you through connecting GitHub, Supabase, and Vercel. You do not need a Vercel account before you begin.</p>
      <form onSubmit={requestLink} className="mt-7 space-y-3">
        <input required type="email" autoComplete="email" placeholder="you@email.com" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3.5 outline-none focus:border-teal-700" />
        <button disabled={busy} className="min-h-12 w-full rounded-2xl bg-teal-800 px-5 font-semibold text-white disabled:opacity-60">{busy ? 'Sending…' : 'Continue with email'}</button>
      </form>
      {message ? <p className="mt-3 text-sm text-teal-800">{message}</p> : null}
    </GatewayShell>
  )
  if (!app) return <GatewayShell><p className="mt-3 text-stone-600">Preparing your private setup…</p><p className="mt-2 text-sm leading-6 text-stone-500">Next, you’ll connect the services that will own your code, database, and deployment.</p>{message ? <p className="mt-5 text-sm text-teal-800">{message}</p> : null}{!busy && message ? <button type="button" onClick={() => { setupStarted.current = false; setSessionReady(false); window.setTimeout(() => setSessionReady(true), 0) }} className="mt-5 min-h-12 w-full rounded-2xl border border-teal-800 px-5 font-semibold text-teal-900">Try again</button> : null}</GatewayShell>
  return <GatewayShell><p className="mt-3 text-stone-600">Opening your private tracker…</p>{message ? <p className="mt-5 text-sm text-red-700">{message}</p> : null}</GatewayShell>
}

function GatewayShell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6"><p className="text-sm font-semibold uppercase tracking-wide text-teal-800">Spend</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Your money, in one place.</h1>{children}</main>
}
