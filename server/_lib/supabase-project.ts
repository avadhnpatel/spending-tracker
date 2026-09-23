export const supabaseRegionGroups = ['americas', 'emea', 'apac'] as const

export type SupabaseRegionGroup = typeof supabaseRegionGroups[number]

export function parseSupabaseRegionGroup(value: unknown): SupabaseRegionGroup {
  return typeof value === 'string' && supabaseRegionGroups.includes(value as SupabaseRegionGroup)
    ? value as SupabaseRegionGroup
    : 'americas'
}

export function supabaseProjectBody(organizationSlug: string, name: string, dbPass: string, regionGroup: SupabaseRegionGroup) {
  return {
    organization_slug: organizationSlug,
    name,
    db_pass: dbPass,
    region_selection: { type: 'smartGroup', code: regionGroup },
  }
}

export function resumableSupabaseProjectName(requestedName: string, sessionId: string): string {
  const base = requestedName.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'spend-private'
  const suffix = sessionId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10)
  return suffix ? `${base}-${suffix}` : base
}

export function controlPlaneProjectRef(url: string | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    const match = parsed.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/)
    return parsed.protocol === 'https:' ? match?.[1] ?? null : null
  } catch {
    return null
  }
}

export function isControlPlaneProject(ref: string, url: string | undefined = process.env.SETUP_SUPABASE_URL): boolean {
  return ref === controlPlaneProjectRef(url)
}
