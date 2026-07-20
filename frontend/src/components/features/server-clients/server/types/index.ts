export interface ServerLocation {
  id: string
  name: string
  hierarchical_path?: string | null
}

export interface ServerCluster {
  id: string
  name: string
}

export interface ServerContactRole {
  id: string
  name: string
}

export interface ServerContact {
  id: string
  name: string
  role: ServerContactRole
  association_id?: string | null
}

export interface SelectedInterface {
  name: string
  address?: string
  netmask?: string
  broadcast?: string
  network?: string
  prefix?: string
}

/** Parameters used to gather Ansible facts (password is not stored; use credential_id). */
export interface AnsibleCredentials {
  target: string
  agent_id: string
  use_sshkey: boolean
  ansible_user: string
  credential_id?: number | null
}

/**
 * A single listening port and the address it is bound to.
 * address "0.0.0.0" / "::" / "*" means the port is reachable on every
 * interface; anything else (e.g. "127.0.0.1", "::1") is bound to one interface only.
 */
export interface PortBinding {
  address: string
  port: number
}

/** Open TCP/UDP ports discovered by the get_open_ports agent command. */
export interface ServerOpenPorts {
  tcp_ports: PortBinding[]
  udp_ports: PortBinding[]
}

/** Lightweight server row from GET /api/servers (no ansible_facts). */
export interface ServerSummaryResponse {
  id: number
  hostname: string
  location: ServerLocation | null
  cluster: ServerCluster | null
  distribution: string | null
  distribution_release: string | null
  distribution_version: string | null
  contact: ServerContact[] | null
  is_virtual: boolean
}

export interface ServerResponse {
  id: number
  hostname: string
  location: ServerLocation | null
  cluster: ServerCluster | null
  primary_ipv4: string | null
  primary_interface: string | null
  os_family: string | null
  processor_count: number | null
  memtotal_mb: number | null
  disk_count: number | null
  disk_total_gb: number | null
  disk_usage_pct: number | null
  architecture: string | null
  distribution: string | null
  distribution_release: string | null
  distribution_version: string | null
  contact: ServerContact[] | null
  nautobot_uuid: string | null
  is_virtual: boolean
  ansible_facts: Record<string, unknown> | null
  ansible_credentials: AnsibleCredentials | null
  selected_interfaces: SelectedInterface[] | null
  open_ports: ServerOpenPorts | null
  created_at: string | null
  updated_at: string | null
}

export interface ListServersResponse {
  servers: ServerSummaryResponse[]
  total: number
  total_all: number
}

export type GroupByField =
  | 'none'
  | 'location'
  | 'cluster'
  | 'distribution_release'
  | 'distribution_version'
  | 'contact'
  | 'is_virtual'

export interface ServerGroup {
  name: string
  servers: ServerSummaryResponse[]
}
