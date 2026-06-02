import type { CreateBaselineRequest, DistributionConfig } from './types'

export const DEFAULT_DISTRIBUTION: DistributionConfig = {
  mode: 'even',
  seed: 42,
  by_location: [],
}

export const DEFAULT_FORM_VALUES: CreateBaselineRequest = {
  name: 'baseline',
  prefixes:
    '192.168.178.0/24,192.168.179.0/24,192.168.180.0/24,192.168.181.0/24',
  network_device_role: 'Network',
  server_role: 'Server',
  vm_role: 'Virtual Machine',
  tags: 'Production,Staging,lab',
  custom_fields: '',
  location_hierarchy: 'Country -> State -> City -> Building',
  number_of_locations: 3,
  number_of_network_devices: 10,
  number_of_servers: 2,
  number_of_virtual_machines: 0,
  number_of_clusters: 1,
  distribution: DEFAULT_DISTRIBUTION,
}

export function locationLabel(index: number): string {
  let label = ''
  let n = index
  while (true) {
    label = String.fromCharCode(65 + (n % 26)) + label
    n = Math.floor(n / 26) - 1
    if (n < 0) break
  }
  return `Location ${label}`
}

export function buildManualDistributionRows(
  locationCount: number
): { location: string; network: number; server: number; vm: number }[] {
  return Array.from({ length: locationCount }, (_, i) => ({
    location: locationLabel(i),
    network: 0,
    server: 0,
    vm: 0,
  }))
}
