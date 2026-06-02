import { describe, expect, it } from 'vitest'

import { buildServerTreeRows } from './build-server-tree-rows'
import type { ServerSummaryResponse } from '../types'

function summary(
  overrides: Partial<ServerSummaryResponse> & Pick<ServerSummaryResponse, 'id' | 'hostname'>
): ServerSummaryResponse {
  return {
    location: null,
    cluster: null,
    distribution_release: null,
    distribution_version: null,
    contact: null,
    is_virtual: false,
    ...overrides,
  }
}

describe('buildServerTreeRows', () => {
  it('includes only root when grouped and collapsed', () => {
    const servers = [
      summary({
        id: 1,
        hostname: 'a',
        location: { id: '1', name: 'DC1' },
      }),
    ]
    const rows = buildServerTreeRows(servers, 'location', new Set(), false)
    expect(rows).toHaveLength(2)
    expect(rows[0]?.type).toBe('root')
    expect(rows[1]?.type).toBe('group')
  })

  it('expands servers when expandAllGroups is true', () => {
    const servers = [
      summary({
        id: 1,
        hostname: 'a',
        location: { id: '1', name: 'DC1' },
      }),
    ]
    const rows = buildServerTreeRows(servers, 'location', new Set(), true)
    expect(rows.some((r) => r.type === 'server')).toBe(true)
  })

  it('groups by contact name when contact object exists', () => {
    const servers = [
      summary({
        id: 1,
        hostname: 'a',
        contact: { id: '13b79fe1-264f-40a3-91ed-9e93dd45a5d4', name: 'Ops' },
      }),
      summary({
        id: 2,
        hostname: 'b',
        contact: null,
      }),
    ]
    const rows = buildServerTreeRows(servers, 'contact', new Set(['Ops', 'Uncategorized']), false)
    const groups = rows.filter((r) => r.type === 'group')
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ type: 'group', name: 'Ops' })
    expect(groups[1]).toMatchObject({ type: 'group', name: 'Uncategorized' })
  })
})
