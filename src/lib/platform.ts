import { Capacitor } from '@capacitor/core'

export const isNativePlatform = () => Capacitor.isNativePlatform()

export function provisioningBaseUrl(): string {
  return (
    import.meta.env.VITE_PROVISIONING_URL ||
    import.meta.env.VITE_APP_URL ||
    (isNativePlatform() ? 'https://spending-tracker-bice-omega.vercel.app' : window.location.origin)
  ).replace(/\/$/, '')
}

export function authRedirectUrl(): string {
  if (isNativePlatform()) return 'spend://auth/callback'
  return `${window.location.origin}/auth/callback`
}
