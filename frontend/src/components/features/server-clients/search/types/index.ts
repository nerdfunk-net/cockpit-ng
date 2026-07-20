export type SearchFieldName =
  | 'memtotal_mb'
  | 'processor_count'
  | 'disk_count'
  | 'disk_total_gb'
  | 'disk_usage_pct'
  | 'os_family'
  | 'distribution'
  | 'distribution_version'
  | 'is_virtual'

export type SearchOp = 'gt' | 'lt' | 'eq' | 'in'

export type SearchCombinator = 'and' | 'or'

export interface SearchRule {
  id: string
  field: SearchFieldName
  op: SearchOp
  value: number | string | boolean | string[]
}

export interface SearchGroup {
  id: string
  combinator: SearchCombinator
  not: boolean
  rules: Array<SearchRule | SearchGroup>
}

export interface ServerSearchHit {
  id: number
  hostname: string
  location: { id: string; name: string; hierarchical_path?: string | null } | null
  cluster: { id: string; name: string } | null
  os_family: string | null
  processor_count: number | null
  memtotal_mb: number | null
  disk_count: number | null
  disk_total_gb: number | null
  disk_usage_pct: number | null
  distribution: string | null
  distribution_release: string | null
  distribution_version: string | null
  contact: unknown
  is_virtual: boolean
}

export interface ServerSearchResponse {
  servers: ServerSearchHit[]
  total: number
}

export interface ServerSearchFacets {
  os_family: string[]
  distribution: string[]
  distribution_version: string[]
}

export function isSearchGroup(item: SearchRule | SearchGroup): item is SearchGroup {
  return 'combinator' in item && 'rules' in item
}

export const SEARCH_FIELD_LABELS: Record<SearchFieldName, string> = {
  memtotal_mb: 'RAM (GB)',
  processor_count: 'CPU',
  disk_count: 'Disk count',
  disk_total_gb: 'Disk size (GB)',
  disk_usage_pct: 'Disk usage (%)',
  os_family: 'OS Family',
  distribution: 'Distribution',
  distribution_version: 'Distribution version',
  is_virtual: 'Virtual Machine',
}

export const NUMERIC_FIELDS: SearchFieldName[] = [
  'memtotal_mb',
  'processor_count',
  'disk_count',
  'disk_total_gb',
  'disk_usage_pct',
]

export const STRING_FIELDS: SearchFieldName[] = [
  'os_family',
  'distribution',
  'distribution_version',
]

let nextId = 0
function newId(): string {
  nextId += 1
  return `q-${nextId}`
}

export function createEmptyRule(): SearchRule {
  return { id: newId(), field: 'memtotal_mb', op: 'gt', value: 8 }
}

export function createEmptyGroup(): SearchGroup {
  return { id: newId(), combinator: 'and', not: false, rules: [createEmptyRule()] }
}

/** Convert UI query (RAM in GB, local ids) to API query (memtotal_mb). */
export function toApiSearchGroup(group: SearchGroup): {
  combinator: SearchCombinator
  not: boolean
  rules: Array<
    | { field: SearchFieldName; op: SearchOp; value: SearchRule['value'] }
    | { combinator: SearchCombinator; not: boolean; rules: unknown[] }
  >
} {
  return {
    combinator: group.combinator,
    not: group.not,
    rules: group.rules.map((item) => {
      if (isSearchGroup(item)) return toApiSearchGroup(item)
      const value =
        item.field === 'memtotal_mb' && typeof item.value === 'number'
          ? Math.round(item.value * 1024)
          : item.value
      return { field: item.field, op: item.op, value }
    }),
  }
}
