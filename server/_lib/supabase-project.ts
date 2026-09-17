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
