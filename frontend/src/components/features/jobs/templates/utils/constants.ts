import type {
  JobTemplate,
  JobType,
  GitRepository,
  SavedInventory,
  CommandTemplate,
  CustomField,
  IpAddressStatus,
  IpAddressTag,
  CsvRepoFile,
} from '../types'

// React best practice: Extract default objects to prevent re-render loops
export const EMPTY_TEMPLATES: JobTemplate[] = []
export const EMPTY_TYPES: JobType[] = []
export const EMPTY_REPOS: GitRepository[] = []
export const EMPTY_INVENTORIES: SavedInventory[] = []
export const EMPTY_CMD_TEMPLATES: CommandTemplate[] = []
export const EMPTY_CUSTOM_FIELDS: CustomField[] = []
export const EMPTY_IP_STATUSES: IpAddressStatus[] = []
export const EMPTY_IP_TAGS: IpAddressTag[] = []
export const EMPTY_CSV_FILES: CsvRepoFile[] = []
export const EMPTY_HEADERS: string[] = []

export const JOB_TYPE_LABELS: Record<string, string> = {
  backup: 'Backup',
  compare_devices: 'Compare Devices',
  run_commands: 'Run Commands',
  cache_devices: 'Cache Devices',
  sync_devices: 'Sync Devices',
  scan_prefixes: 'Scan Prefixes',
  deploy_agent: 'Deploy Agent',
  ip_addresses: 'Maintain IP-Addresses',
  csv_import: 'CSV Import',
  csv_export: 'CSV Export',
  ping_agent: 'Ping Agent',
  set_primary_ip: 'Set Primary IP',
  get_client_data: 'Get Client Data',
} as const

export const JOB_TYPE_COLORS: Record<string, string> = {
  backup: 'bg-blue-500',
  compare_devices: 'bg-purple-500',
  run_commands: 'bg-green-500',
  cache_devices: 'bg-cyan-500',
  sync_devices: 'bg-orange-500',
  scan_prefixes: 'bg-purple-500',
  deploy_agent: 'bg-teal-500',
  ip_addresses: 'bg-emerald-500',
  csv_import: 'bg-yellow-500',
  csv_export: 'bg-emerald-600',
  ping_agent: 'bg-sky-500',
  set_primary_ip: 'bg-cyan-600',
  get_client_data: 'bg-emerald-500',
} as const

export const CSV_EXPORT_PROPERTIES: {
  id: string
  label: string
  description: string
}[] = [
  { id: 'name', label: 'Name', description: 'Device name' },
  {
    id: 'device_type',
    label: 'Device Type',
    description: 'Device type/model information',
  },
  {
    id: 'platform',
    label: 'Platform',
    description: 'Device platform (e.g., cisco_ios)',
  },
  { id: 'role', label: 'Role', description: 'Device role' },
  { id: 'status', label: 'Status', description: 'Device status' },
  { id: 'location', label: 'Location', description: 'Device location/site' },
  { id: 'asset_tag', label: 'Asset Tag', description: 'Asset tag identifier' },
  {
    id: '_custom_field_data',
    label: 'Custom Field Data',
    description: 'Custom field data',
  },
  { id: 'serial', label: 'Serial Number', description: 'Device serial number' },
  { id: 'primary_ip4', label: 'Primary IPv4', description: 'Primary IPv4 address' },
  { id: 'namespace', label: 'Namespace', description: 'IP namespace' },
  {
    id: 'interfaces',
    label: 'Interfaces',
    description: 'Network interfaces with IP addresses',
  },
  { id: 'tags', label: 'Tags', description: 'Device tags' },
]

export const CSV_IMPORT_FORMAT_LABELS: Record<string, string> = {
  generic: 'Generic',
  nautobot: 'Nautobot Export',
  cockpit: 'Cockpit Export',
} as const

export const CSV_IMPORT_TYPE_LABELS: Record<string, string> = {
  devices: 'Devices',
  'ip-prefixes': 'IP Prefixes',
  'ip-addresses': 'IP Addresses',
} as const

export const CSV_IMPORT_NAUTOBOT_FIELDS: Record<string, string[]> = {
  devices: [
    'name',
    'status',
    'role',
    'device_type',
    'location',
    'rack',
    'platform',
    'serial',
    'asset_tag',
    'position',
    'face',
    'comments',
    // Interface fields — mapped columns are extracted and used to create
    // one interface (and optionally assign a primary IP) on the device.
    'interface_name',
    'interface_type',
    'interface_status',
    'interface_ip_address',
    'interface_namespace',
    'interface_description',
    'cf_last_scan',
    'cf_net',
    'cf_vlan_id',
  ],
  'ip-prefixes': [
    'prefix',
    'namespace',
    'status',
    'role',
    'type',
    'description',
    'vlan',
    'tenant',
    'vrf',
    'comments',
    'cf_vlan_id',
    'cf_network_type',
  ],
  'ip-addresses': [
    'address',
    'namespace',
    'status',
    'role',
    'type',
    'description',
    'dns_name',
    'tenant',
    'vrf',
    'comments',
    'cf_last_scan',
    'cf_vlan_id',
  ],
} as const

export const DEFAULT_TEMPLATE: Partial<JobTemplate> = {
  inventory_source: 'all',
  is_global: false,
  parallel_tasks: 1,
  activate_changes_after_sync: true,
  scan_resolve_dns: false,
} as const

export const STALE_TIME = {
  TEMPLATES: 30 * 1000, // 30 seconds - moderately dynamic
  JOB_TYPES: 5 * 60 * 1000, // 5 minutes - rarely changes
  CONFIG_REPOS: 2 * 60 * 1000, // 2 minutes - occasionally changes
  INVENTORIES: 30 * 1000, // 30 seconds - moderately dynamic
  CMD_TEMPLATES: 2 * 60 * 1000, // 2 minutes - occasionally changes
  CUSTOM_FIELDS: 5 * 60 * 1000, // 5 minutes - rarely changes
  IP_OPTIONS: 5 * 60 * 1000, // 5 minutes - IP statuses and tags rarely change
  CSV_REPOS: 2 * 60 * 1000, // 2 minutes - git repos occasionally change
  CSV_FILES: 30 * 1000, // 30 seconds - files can change after git pull
  CSV_HEADERS: 60 * 1000, // 1 minute - headers rarely change between saves
  NAUTOBOT_DEFAULTS: 5 * 60 * 1000, // 5 minutes - rarely changes
} as const
