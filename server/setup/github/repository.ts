import { decryptSecret } from '../../_lib/crypto.js'
import { allowMethods, publicError } from '../../_lib/http.js'
import { publicSession, sessionFromRequest, updateSession } from '../../_lib/store.js'
import type { ApiRequest, ApiResponse } from '../../_lib/types.js'

type RepositoryInput = { name?: string }

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!allowMethods(request, response, ['POST'])) return
  try {
    const session = await sessionFromRequest(request)
    if (!session?.github_token_encrypted || !session.github_login) {
      response.status(409).json({ error: 'Connect GitHub before creating a repository' })
      return
    }
    if (session.repository_full_name) {
      response.status(200).json(publicSession(session))
      return
    }
    const input = (request.body ?? {}) as RepositoryInput
    const name = input.name?.trim() || 'spend-private'
    if (!/^[A-Za-z0-9._-]{1,100}$/.test(name)) {
      response.status(400).json({ error: 'Repository name may use letters, numbers, dots, dashes, and underscores' })
      return
    }
    const templateOwner = process.env.GITHUB_TEMPLATE_OWNER
    const templateRepo = process.env.GITHUB_TEMPLATE_REPO
    if (!templateOwner || !templateRepo) throw new Error('GitHub template repository is not configured')
    const githubResponse = await fetch(`https://api.github.com/repos/${encodeURIComponent(templateOwner)}/${encodeURIComponent(templateRepo)}/generate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${decryptSecret(session.github_token_encrypted)}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ owner: session.github_login, name, private: true, include_all_branches: false }),
    })
    const repository = await githubResponse.json() as { full_name?: string; message?: string }
    if (!githubResponse.ok || !repository.full_name) throw new Error(repository.message || 'GitHub could not create the repository')
    const updated = await updateSession(session.id, { repository_full_name: repository.full_name, error_message: null })
    response.status(201).json(publicSession(updated))
  } catch (error) {
    response.status(500).json({ error: publicError(error) })
  }
}
