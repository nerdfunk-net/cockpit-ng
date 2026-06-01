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
})
