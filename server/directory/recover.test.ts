import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiRequest, ApiResponse, SetupSession } from '../_lib/types'

const directoryUserFromRequest = vi.fn()
const createSession = vi.fn()
const updateSession = vi.fn()
const publicSession = vi.fn()

vi.mock('../_lib/directory.js', () => ({ directoryUserFromRequest }))
vi.mock('../_lib/store.js', () => ({ createSession, updateSession, publicSession }))

const { default: recover } = await import('./recover')

describe('database recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts recovery even when the account already has a linked project', async () => {
    const user = { id: 'directory-user', email: 'owner@example.com' }
    const created = { id: 'setup-session' } as SetupSession
    const recovering = { ...created, status: 'recover_project' } as SetupSession
    directoryUserFromRequest.mockResolvedValue(user)
    createSession.mockResolvedValue(created)
    updateSession.mockResolvedValue(recovering)
    publicSession.mockReturnValue({ id: created.id, status: 'recover_project' })

    const json = vi.fn()
    const response = {
      status: vi.fn().mockReturnThis(),
      json,
    } as unknown as ApiResponse

    await recover({ method: 'POST', headers: {}, query: {} } as ApiRequest, response)

    expect(createSession).toHaveBeenCalledWith(response, user)
    expect(updateSession).toHaveBeenCalledWith(created.id, { status: 'recover_project' })
    expect(response.status).toHaveBeenCalledWith(201)
    expect(json).toHaveBeenCalledWith({ id: created.id, status: 'recover_project' })
  })
})
