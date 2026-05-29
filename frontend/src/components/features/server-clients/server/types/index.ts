export interface ServerResponse {
  id: number
  hostname: string
  location: string | null
  primary_ipv4: string | null
  primary_interface: string | null
  os_family: string | null
  processor_count: number | null
  memtotal_mb: number | null
  disk_count: number | null
  architecture: string | null
  distribution_release: string | null
  distribution_version: string | null
  contact: string | null
  nautobot_uuid: string | null
  ansible_facts: Record<string, unknown> | null
  created_at: string | null
  updated_at: string | null
}

export interface ListServersResponse {
  servers: ServerResponse[]
  total: number
}

export type GroupByField =
  | 'none'
  | 'location'
  | 'distribution_release'
  | 'distribution_version'
  | 'contact'

export interface ServerGroup {
  name: string
  servers: ServerResponse[]
}
