import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { configured, user, sendMagicLink } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')

  if (user) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('sending')
    try {
      await sendMagicLink(email.trim())
      setStatus('sent')
      setMessage('Check your email for a sign-in link.')
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Could not send link')
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
      <p className="text-sm font-semibold tracking-wide text-teal-800 uppercase">Spend</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Your money, in one place.</h1>
      <p className="mt-3 text-stone-600">
        Enter your email to sign in or create your private account. No password required.
      </p>

      {!configured ? (
        <div className="mt-8 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950">
          Add <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to{' '}
          <code>.env</code> (local) or Vercel env vars, then restart the app.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3.5 outline-none focus:border-teal-700"
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            className="w-full rounded-2xl bg-teal-800 py-3.5 font-semibold text-white disabled:opacity-60"
          >
            {status === 'sending' ? 'Sending…' : 'Email me a link'}
          </button>
          {message ? (
            <p className={`text-sm ${status === 'error' ? 'text-red-700' : 'text-teal-800'}`}>
              {message}
            </p>
          ) : null}
        </form>
      )}
    </div>
  )
}
