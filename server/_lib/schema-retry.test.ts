import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('provisioned Supabase schema', () => {
  it('replaces every policy inside one retry-safe transaction', async () => {
    const sql = await readFile(new URL('../../supabase/schema.sql', import.meta.url), 'utf8')
    const creates = [...sql.matchAll(/create policy\s+"([^"]+)"\s+on\s+([^\s;]+)/gi)]

    expect(sql.trimStart().toLowerCase()).toMatch(/^--[^\n]*\n\nbegin;/)
    expect(sql.trimEnd().toLowerCase()).toMatch(/commit;$/)
    expect(creates.length).toBeGreaterThan(0)

    for (const [, name, table] of creates) {
      expect(sql.toLowerCase()).toContain(`drop policy if exists "${name.toLowerCase()}" on ${table.toLowerCase()};`)
    }
  })
})
