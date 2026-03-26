import type { CSVConfig, ParsedCSVData, ValidationResult, ObjectType } from './types'

export const DEFAULT_CSV_CONFIG: CSVConfig = {
  delimiter: ',',
  quoteChar: '"',
}

export const EMPTY_PARSED_DATA: ParsedCSVData = {
  headers: [],
  rows: [],
  rowCount: 0,
}

export const EMPTY_VALIDATION_RESULTS: ValidationResult[] = []

export const OBJECT_TYPE_LABELS: Record<string, string> = {
  devices: 'Devices',
  'ip-prefixes': 'IP Prefixes',
  'ip-addresses': 'IP Addresses',
  locations: 'Locations',
}

/** Nautobot fields that can be updated for each object type. */
export const NAUTOBOT_UPDATE_FIELDS: Record<
  ObjectType,
  { key: string; label: string }[]
> = {
  devices: [
    { key: 'name', label: 'Device Name' },
    { key: 'status', label: 'Status' },
    { key: 'role', label: 'Role' },
    { key: 'location', label: 'Location' },
    { key: 'device_type', label: 'Device Type' },
    { key: 'platform', label: 'Platform' },
    { key: 'software_version', label: 'Software Version' },
    { key: 'serial', label: 'Serial Number' },
    { key: 'asset_tag', label: 'Asset Tag' },
    { key: 'rack', label: 'Rack' },
    { key: 'position', label: 'Rack Position' },
    { key: 'face', label: 'Rack Face' },
    { key: 'tenant', label: 'Tenant' },
    { key: 'comments', label: 'Comments' },
    { key: 'tags', label: 'Tags' },
  ],
  'ip-prefixes': [
    { key: 'prefix', label: 'Prefix' },
    { key: 'namespace', label: 'Namespace' },
    { key: 'status', label: 'Status' },
    { key: 'role', label: 'Role' },
    { key: 'type', label: 'Type' },
    { key: 'description', label: 'Description' },
    { key: 'vlan', label: 'VLAN' },
    { key: 'tenant', label: 'Tenant' },
    { key: 'comments', label: 'Comments' },
    { key: 'tags', label: 'Tags' },
  ],
  'ip-addresses': [
    { key: 'address', label: 'IP Address' },
    { key: 'namespace', label: 'Namespace' },
    { key: 'status', label: 'Status' },
    { key: 'role', label: 'Role' },
    { key: 'type', label: 'Type' },
    { key: 'dns_name', label: 'DNS Name' },
    { key: 'description', label: 'Description' },
    { key: 'tenant', label: 'Tenant' },
    { key: 'comments', label: 'Comments' },
    { key: 'tags', label: 'Tags' },
  ],
  locations: [
    { key: 'name', label: 'Location Name' },
    { key: 'status', label: 'Status' },
    { key: 'location_type', label: 'Location Type' },
    { key: 'description', label: 'Description' },
    { key: 'facility', label: 'Facility' },
    { key: 'tenant', label: 'Tenant' },
    { key: 'comments', label: 'Comments' },
    { key: 'tags', label: 'Tags' },
  ],
}

/**
 * Auto-detect field mapping for a CSV based on known Nautobot field keys.
 * Exact header-name matches are mapped automatically; others default to null.
 */
export function buildAutoFieldMapping(
  headers: string[],
  type: ObjectType
): Record<string, string | null> {
  const knownKeys = new Set(NAUTOBOT_UPDATE_FIELDS[type].map(f => f.key))
  const result: Record<string, string | null> = {}
  for (const h of headers) {
    result[h] = knownKeys.has(h) ? h : null
  }
  return result
}
