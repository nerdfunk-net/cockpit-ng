import type {
  BaselineProfileDetail,
  CreateBaselineRequest,
  DistributionConfig,
} from './types'
import type { TestsBaselineFormValues } from './tests-baseline-schema'

export const DEFAULT_DISTRIBUTION: DistributionConfig = {
  mode: 'even',
  seed: 42,
  by_location: [],
}

/** Device/VM custom field template (key=value pairs, comma-separated). */
export const DEFAULT_BASELINE_CUSTOM_FIELDS =
  'net=netA,checkmk_site=siteA,free_textfield=Device in City A,last_backup=2025-02-20,snmp_credentials=credA'

export const DEFAULT_FORM_VALUES: CreateBaselineRequest = {
  name: 'baseline',
  prefixes:
    '192.168.178.0/24,192.168.179.0/24,192.168.180.0/24,192.168.181.0/24',
  network_device_role: 'Network',
  server_role: 'Server',
  vm_role: 'Virtual Machine',
  tags: 'Production,Staging,lab',
  custom_fields: DEFAULT_BASELINE_CUSTOM_FIELDS,
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

export function profileRequestToFormValues(
  profile: BaselineProfileDetail
): TestsBaselineFormValues {
  const request = profile.request
  const distribution = request.distribution
  const locationCount = request.number_of_locations ?? 3

  return {
    profile: profile.id,
    name: request.name ?? 'baseline',
    prefixes: request.prefixes ?? DEFAULT_FORM_VALUES.prefixes,
    network_device_role:
      request.network_device_role ?? DEFAULT_FORM_VALUES.network_device_role,
    server_role: request.server_role ?? DEFAULT_FORM_VALUES.server_role,
    vm_role: request.vm_role ?? DEFAULT_FORM_VALUES.vm_role,
    tags: request.tags ?? DEFAULT_FORM_VALUES.tags,
    custom_fields: request.custom_fields ?? '',
    location_hierarchy:
      request.location_hierarchy ?? DEFAULT_FORM_VALUES.location_hierarchy,
    number_of_locations: locationCount,
    number_of_network_devices:
      request.number_of_network_devices ??
      DEFAULT_FORM_VALUES.number_of_network_devices,
    number_of_servers:
      request.number_of_servers ?? DEFAULT_FORM_VALUES.number_of_servers,
    number_of_virtual_machines:
      request.number_of_virtual_machines ?? 0,
    number_of_clusters: request.number_of_clusters ?? 0,
    distribution_mode: distribution?.mode ?? 'even',
    distribution_seed: distribution?.seed ?? 42,
    manual_distribution:
      distribution?.by_location ?? buildManualDistributionRows(locationCount),
  }
}
