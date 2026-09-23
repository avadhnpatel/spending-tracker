import { describe, expect, it } from 'vitest'
import handler from './index.js'
import type { ApiRequest, ApiResponse } from '../server/_lib/types.js'

function responseRecorder() {
  let status = 200
  let body: unknown
  const response: ApiResponse = {
    status(code) { status = code; return response },
    json(value) { body = value },
    send(value) { body = value },
    redirect() { throw new Error('Unexpected redirect') },
    setHeader() {},
  }
  return { response, result: () => ({ status, body }) }
}

describe('API router', () => {
  it.each(['directory/plaid', 'setup/plaid/configure'])('registers %s', async (path) => {
    const recorder = responseRecorder()
    const request: ApiRequest = { method: 'GET', headers: {}, query: { path } }
    await handler(request, recorder.response)
    expect(recorder.result()).toEqual({ status: 405, body: { error: 'Method not allowed' } })
  })

  it('returns 404 for an unknown route', async () => {
    const recorder = responseRecorder()
    await handler({ method: 'GET', headers: {}, query: { path: 'missing' } }, recorder.response)
    expect(recorder.result()).toEqual({ status: 404, body: { error: 'API route not found' } })
  })
})
