export interface ServerLocation {
  id: string
  name: string
  hierarchical_path?: string | null
}

export interface SelectedInterface {
  name: string
  address?: string
  netmask?: string
  broadcast?: string
  network?: string
  prefix?: string
}

export interface ServerResponse {
  id: number
  hostname: string
  location: ServerLocation | null
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
  is_virtual: boolean
  ansible_facts: Record<string, unknown> | null
  selected_interfaces: SelectedInterface[] | null
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
  | 'is_virtual'

export interface ServerGroup {
  name: string
  servers: ServerResponse[]
}
