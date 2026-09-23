import { CapacitorHttp } from '@capacitor/core'
import { isNativePlatform } from './platform'

export type ProvisioningResponse<T> = { status: number; body: T & { error?: string } }

export async function provisioningJson<T>(url: string, init: RequestInit = {}): Promise<ProvisioningResponse<T>> {
  if (isNativePlatform()) {
    const headers = Object.fromEntries(new Headers(init.headers).entries())
    const response = await CapacitorHttp.request({
      url,
      method: init.method ?? 'GET',
      headers,
      data: typeof init.body === 'string' ? init.body : undefined,
      responseType: 'json',
    })
    const body = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
    return { status: response.status, body: body as T & { error?: string } }
  }
  const response = await fetch(url, init)
  return { status: response.status, body: await response.json() as T & { error?: string } }
}
