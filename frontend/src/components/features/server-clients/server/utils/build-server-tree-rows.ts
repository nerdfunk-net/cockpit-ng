import type { GroupByField, ServerSummaryResponse } from '../types'

export const TREE_ROW_HEIGHT = {
  root: 28,
  group: 34,
  server: 30,
} as const

export type ServerTreeRow =
  | { type: 'root' }
  | { type: 'group'; name: string; count: number }
  | { type: 'server'; server: ServerSummaryResponse; indented: boolean }

function getGroupKey(server: ServerSummaryResponse, groupBy: GroupByField): string {
  if (groupBy === 'is_virtual') {
    return server.is_virtual ? 'Virtual Machine' : 'Physical'
  }
  if (groupBy === 'location') {
    return server.location?.name ?? 'Uncategorized'
  }
  if (groupBy === 'cluster') {
    return server.cluster?.name ?? 'No cluster'
  }
  type StringGroupBy = 'distribution_release' | 'distribution_version' | 'contact'
  return (server[groupBy as StringGroupBy] as string | null) ?? 'Uncategorized'
}

export function buildServerTreeRows(
  servers: ServerSummaryResponse[],
  groupBy: GroupByField,
  expandedGroups: Set<string>,
  expandAllGroups: boolean
): ServerTreeRow[] {
  const rows: ServerTreeRow[] = [{ type: 'root' }]

  if (groupBy === 'none') {
    for (const server of servers) {
      rows.push({ type: 'server', server, indented: false })
    }
    return rows
  }

  const map = new Map<string, ServerSummaryResponse[]>()
  for (const server of servers) {
    const key = getGroupKey(server, groupBy)
    const existing = map.get(key) ?? []
    map.set(key, [...existing, server])
  }

  const groups = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))

  for (const [name, groupServers] of groups) {
    rows.push({ type: 'group', name, count: groupServers.length })
    if (expandAllGroups || expandedGroups.has(name)) {
      for (const server of groupServers) {
        rows.push({ type: 'server', server, indented: true })
      }
    }
  }

  return rows
}

export function getServerTreeRowHeight(row: ServerTreeRow): number {
  switch (row.type) {
    case 'root':
      return TREE_ROW_HEIGHT.root
    case 'group':
      return TREE_ROW_HEIGHT.group
    case 'server':
      return TREE_ROW_HEIGHT.server
  }
}
