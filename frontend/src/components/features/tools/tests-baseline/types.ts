export type DistributionMode = 'even' | 'random' | 'manual'

export interface LocationDistributionRow {
  location: string
  network: number
  server: number
  vm: number
}

export interface DistributionConfig {
  mode: DistributionMode
  seed: number
  by_location: LocationDistributionRow[]
}

export interface CreateBaselineRequest {
  name: string
  prefixes: string
  network_device_role: string
  server_role: string
  vm_role: string
  tags: string
  custom_fields: string
  location_hierarchy: string
  number_of_locations: number
  number_of_network_devices: number
  number_of_servers: number
  number_of_virtual_machines: number
  number_of_clusters: number
  distribution?: DistributionConfig
  profile?: string
  layout?: 'default' | 'pytest_legacy'
  naming_scheme?: 'ip' | 'sequential'
  metadata_mode?: 'generated' | 'golden_parity'
  golden_reference_path?: string
}

export interface BaselineProfileSummary {
  id: string
  label: string
  description: string
}

export interface BaselineProfileDetail {
  id: string
  label: string
  description: string
  output?: {
    filename?: string
    suggested_import_dir?: string
  }
  request: Partial<CreateBaselineRequest>
}

export interface BaselineStats {
  total_devices: number
  network_devices: number
  server_devices: number
  virtual_machines: number
  clusters: number
  locations: Record<string, number>
  tags: Record<string, number>
  statuses: Record<string, number>
}

export interface CreateBaselineResponse {
  success: boolean
  message: string
  path: string
  filename: string
  stats: BaselineStats
  distribution: Record<string, number>
  profile?: string
  warnings?: string[]
}
