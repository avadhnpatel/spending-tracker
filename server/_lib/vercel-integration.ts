export function vercelIntegrationUrl(state: string): string {
  const slug = process.env.VERCEL_INTEGRATION_SLUG
  if (!slug) throw new Error('Vercel integration is not configured')
  const url = new URL(`https://vercel.com/integrations/${encodeURIComponent(slug)}/new`)
  url.searchParams.set('state', state)
  return url.toString()
}
