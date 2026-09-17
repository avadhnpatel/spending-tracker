import directoryMe from '../server/directory/me.js'
import directoryStartSetup from '../server/directory/start-setup.js'
import githubRepository from '../server/setup/github/repository.js'
import mobileActivate from '../server/setup/mobile/activate.js'
import mobileClaim from '../server/setup/mobile/claim.js'
import mobileStart from '../server/setup/mobile/start.js'
import githubCallback from '../server/setup/oauth/github/callback.js'
import githubStart from '../server/setup/oauth/github/start.js'
import supabaseCallback from '../server/setup/oauth/supabase/callback.js'
import supabaseStart from '../server/setup/oauth/supabase/start.js'
import vercelCallback from '../server/setup/oauth/vercel/callback.js'
import vercelStart from '../server/setup/oauth/vercel/start.js'
import options from '../server/setup/options.js'
import provision from '../server/setup/provision.js'
import session from '../server/setup/session.js'
import type { ApiRequest, ApiResponse } from '../server/_lib/types.js'

type Handler = (request: ApiRequest, response: ApiResponse) => Promise<void>

const routes: Record<string, Handler> = {
  'directory/me': directoryMe,
  'directory/start-setup': directoryStartSetup,
  'setup/session': session,
  'setup/options': options,
  'setup/provision': provision,
  'setup/github/repository': githubRepository,
  'setup/mobile/activate': mobileActivate,
  'setup/mobile/claim': mobileClaim,
  'setup/mobile/start': mobileStart,
  'setup/oauth/github/start': githubStart,
  'setup/oauth/github/callback': githubCallback,
  'setup/oauth/supabase/start': supabaseStart,
  'setup/oauth/supabase/callback': supabaseCallback,
  'setup/oauth/vercel/start': vercelStart,
  'setup/oauth/vercel/callback': vercelCallback,
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('X-Spend-Revision', process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local')
  const value = request.query.path
  const path = Array.isArray(value) ? value.join('/') : value ?? ''
  const target = routes[path]
  if (!target) return response.status(404).json({ error: 'API route not found' })
  await target(request, response)
}
