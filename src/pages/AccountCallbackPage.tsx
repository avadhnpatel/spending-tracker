import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { directorySession } from '../lib/directory'

export function AccountCallbackPage() {
  const navigate = useNavigate(); const [message, setMessage] = useState('Signing you in…')
  useEffect(() => { void directorySession().then((session) => { if (!session) setMessage('That sign-in link is invalid or has expired. Request a new one.'); else navigate('/account', { replace: true }) }) }, [navigate])
  return <main className="flex min-h-dvh items-center justify-center px-6 text-center text-stone-600">{message}</main>
}
