import type { CSVConfig, ParsedCSVData, ValidationResult, ObjectType } from '../types'

export const DEFAULT_CSV_CONFIG: CSVConfig = {
  delimiter: ',',
  quoteChar: '"',
}

/** Page sizes offered on the Filter step's row table. */
export const FILTER_PAGE_SIZE_OPTIONS = [50, 100, 200, 500]

export const DEFAULT_FILTER_PAGE_SIZE = 50

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
    { key: 'interface_name', label: 'Interface Name' },
    { key: 'interface_type', label: 'Interface Type' },
    { key: 'interface_status', label: 'Interface Status' },
    { key: 'interface_ip_address', label: 'Interface IP Address' },
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
 * Fields eligible for "Default Properties". Deliberately narrow: an update must only
 * ever touch what the CSV explicitly provides, with one exception — a CSV row that
 * defines a new interface (by name) but omits its status/type still needs a fallback
 * so the interface can be created. No other field may be defaulted.
 */
export const DEFAULT_PROPERTY_FIELDS: Record<ObjectType, { key: string; label: string }[]> = {
  devices: [
    { key: 'interface_status', label: 'Interface Status' },
    { key: 'interface_type', label: 'Interface Type' },
  ],
  'ip-prefixes': [],
  'ip-addresses': [],
  locations: [],
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

/** Devices-only field keys used to merge multiple CSV rows into one device update. */
export const DEVICE_NAME_FIELD_KEY = 'name'
export const PRIMARY_IP_FIELD_KEY = 'interface_ip_address'
export const INTERFACE_NAME_FIELD_KEY = 'interface_name'
export const INTERFACE_TYPE_FIELD_KEY = 'interface_type'
export const INTERFACE_STATUS_FIELD_KEY = 'interface_status'

/** Device-level field keys that may be backfilled from the selected profile. */
export const DEVICE_STATUS_FIELD_KEY = 'status'
export const DEVICE_ROLE_FIELD_KEY = 'role'
export const DEVICE_LOCATION_FIELD_KEY = 'location'
export const DEVICE_TYPE_FIELD_KEY = 'device_type'
export const DEVICE_PLATFORM_FIELD_KEY = 'platform'

/** Interface columns the backend only recognizes by these literal header names. */
export const INTERFACE_CONFIG_FIELD_KEYS = [
  INTERFACE_NAME_FIELD_KEY,
  INTERFACE_TYPE_FIELD_KEY,
  INTERFACE_STATUS_FIELD_KEY,
]

/** Identifies this tool's saved field mapping in the per-user field-mappings store. */
export const CSV_UPDATE_APP_NAME = 'csv-update'

/** Reserved key used to persist the lookup column alongside the field mapping. */
export const LOOKUP_COLUMN_MAPPING_KEY = '__lookup_column__'

/** Reserved keys used to persist the step-1 checkboxes alongside the field mapping. */
export const USE_NEW_MAPPING_KEY = '__use_new_mapping__'
export const USE_DEFAULT_PROPERTIES_KEY = '__use_default_properties__'
export const PRIMARY_IP_ENABLED_KEY = '__primary_ip_enabled__'

/** Reserved key used to persist the selected profile id alongside the field mapping. */
export const SELECTED_PROFILE_ID_KEY = '__selected_profile_id__'
