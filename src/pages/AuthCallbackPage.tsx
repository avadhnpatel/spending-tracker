import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (supabase) {
        await supabase.auth.getSession()
      }
      if (!cancelled) navigate('/', { replace: true })
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [navigate])

  return (
    <div className="flex min-h-dvh items-center justify-center text-stone-600">Signing you in…</div>
  )
}
