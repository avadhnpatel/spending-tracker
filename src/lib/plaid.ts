import { FunctionsHttpError } from '@supabase/supabase-js'
import { requireSupabase } from './supabase'

type PlaidLinkSuccessMetadata = {
  institution?: { institution_id: string; name: string } | null
}

type PlaidHandler = { open: () => void; destroy: () => void }

type PlaidFactory = {
  create: (config: {
    token: string
    receivedRedirectUri?: string
    onSuccess: (publicToken: string, metadata: PlaidLinkSuccessMetadata) => void
    onExit: (error: { display_message?: string } | null) => void
  }) => PlaidHandler
}

declare global {
  interface Window {
    Plaid?: PlaidFactory
  }
}

let loader: Promise<PlaidFactory> | null = null
const LINK_TOKEN_KEY = 'spend.plaidLinkToken'

function loadPlaid(): Promise<PlaidFactory> {
  if (window.Plaid) return Promise.resolve(window.Plaid)
  if (loader) return loader
  loader = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js'
    script.async = true
    script.onload = () => window.Plaid ? resolve(window.Plaid) : reject(new Error('Plaid Link did not load'))
    script.onerror = () => reject(new Error('Could not load Plaid Link'))
    document.head.append(script)
  })
  return loader
}

async function invoke<T>(name: string, body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireSupabase().functions.invoke(name, { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      let response: { error?: string } | null = null
      try {
        response = await error.context.json() as { error?: string }
      } catch { /* fall back to the SDK error */ }
      if (response?.error) throw new Error(response.error)
    }
    throw error
  }
  if (data?.error) throw new Error(data.error)
  return data as T
}

async function openPlaid(token: string, receivedRedirectUri?: string): Promise<void> {
  const plaid = await loadPlaid()
  await new Promise<void>((resolve, reject) => {
    const handler = plaid.create({
      token,
      ...(receivedRedirectUri ? { receivedRedirectUri } : {}),
      onSuccess: (publicToken, metadata) => {
        void invoke('plaid-exchange', {
          public_token: publicToken,
          institution: metadata.institution ?? null,
        }).then(() => {
          localStorage.removeItem(LINK_TOKEN_KEY)
          handler.destroy()
          resolve()
        }, reject)
      },
      onExit: (error) => {
        handler.destroy()
        if (error) reject(new Error(error.display_message || 'Bank connection was not completed'))
        else resolve()
      },
    })
    handler.open()
  })
}

export async function connectPlaid(): Promise<void> {
  const { link_token: token } = await invoke<{ link_token: string }>('plaid-link-token')
  localStorage.setItem(LINK_TOKEN_KEY, token)
  await openPlaid(token)
}

export async function resumePlaidRedirect(): Promise<boolean> {
  if (!new URLSearchParams(window.location.search).has('oauth_state_id')) return false
  const token = localStorage.getItem(LINK_TOKEN_KEY)
  if (!token) throw new Error('The bank connection expired. Please start it again.')
  await openPlaid(token, window.location.href)
  window.history.replaceState({}, '', window.location.pathname)
  return true
}

export async function syncPlaid(): Promise<number> {
  const result = await invoke<{ staged: number }>('plaid-sync')
  return result.staged
}
