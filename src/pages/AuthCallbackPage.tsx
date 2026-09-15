import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function finishSignIn() {
      const hash = new URLSearchParams(window.location.hash.slice(1))
      const search = new URLSearchParams(window.location.search)
      const redirectError = hash.get('error_description') ?? search.get('error_description')

      if (redirectError) {
        if (!cancelled) setError(redirectError.replaceAll('+', ' '))
        return
      }

      if (!supabase) {
        if (!cancelled) setError('Authentication is not configured.')
        return
      }

      const { data, error: sessionError } = await supabase.auth.getSession()
      if (cancelled) return

      if (sessionError) {
        setError(sessionError.message)
        return
      }

      if (!data.session) {
        setError('This sign-in link could not be completed. It may be expired or already used.')
        return
      }

      navigate('/', { replace: true })
    }

    void finishSignIn()
    return () => {
      cancelled = true
    }
  }, [navigate])

  if (error) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
        <p className="text-sm font-semibold tracking-wide text-red-700 uppercase">Sign-in problem</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">That link didn’t work.</h1>
        <p className="mt-3 text-stone-600">{error}</p>
        <Link
          to="/login"
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-teal-800 px-5 font-semibold text-white"
        >
          Request a new link
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-stone-600">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-teal-700" />
      <p>Signing you in…</p>
    </div>
  )
}
