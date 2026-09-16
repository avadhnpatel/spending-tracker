export type ApiRequest = {
  method?: string
  headers: Record<string, string | string[] | undefined>
  query: Record<string, string | string[] | undefined>
  body?: unknown
}

export type ApiResponse = {
  status: (code: number) => ApiResponse
  json: (body: unknown) => void
  send: (body: string) => void
  redirect: (statusOrUrl: number | string, url?: string) => void
  setHeader: (name: string, value: string | string[]) => void
}

export type Provider = 'github' | 'supabase' | 'vercel'

export type SetupSession = {
  id: string
  secret_hash: string
  status: string
  github_connected_at: string | null
  github_login: string | null
  github_token_encrypted: string | null
  github_oauth_state: string | null
  supabase_connected_at: string | null
  supabase_token_encrypted: string | null
  supabase_refresh_token_encrypted: string | null
  supabase_oauth_state: string | null
  supabase_pkce_verifier_encrypted: string | null
  vercel_connected_at: string | null
  vercel_token_encrypted: string | null
  vercel_team_id: string | null
  vercel_oauth_state: string | null
  repository_full_name: string | null
  supabase_project_ref: string | null
  vercel_project_id: string | null
  deployment_url: string | null
  supabase_publishable_key: string | null
  mobile_handoff_hash: string | null
  mobile_handoff_secret_encrypted: string | null
  mobile_claim_hash: string | null
  error_message: string | null
  expires_at: string
  created_at: string
  updated_at: string
  directory_user_id: string | null
  directory_email: string | null
}

export type DirectoryUser = { id: string; email?: string | null }

export type PrivateApp = {
  directory_user_id: string
  email: string
  deployment_url: string
  supabase_project_ref: string
  supabase_publishable_key: string
  vercel_project_id: string | null
  repository_full_name: string | null
}
