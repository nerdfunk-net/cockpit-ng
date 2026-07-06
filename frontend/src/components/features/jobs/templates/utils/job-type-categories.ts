import { FileSpreadsheet, RefreshCw, Archive, Radar, Bot, Shapes } from 'lucide-react'
import type { JobTypeCategory } from '../types'

export const JOB_TYPE_CATEGORIES: JobTypeCategory[] = [
  {
    id: 'nautobot',
    label: 'Nautobot',
    icon: RefreshCw,
    jobTypes: ['sync_devices', 'compare_devices', 'ip_addresses', 'set_primary_ip'],
  },
  {
    id: 'devices',
    label: 'Devices',
    icon: Archive,
    jobTypes: ['backup', 'run_commands'],
  },
  {
    id: 'csv',
    label: 'CSV',
    icon: FileSpreadsheet,
    jobTypes: ['csv_import', 'csv_export'],
  },
  {
    id: 'discovery-scanning',
    label: 'Discovery & Scanning',
    icon: Radar,
    jobTypes: [
      'scan_prefixes',
      'port_scan',
      'get_open_ports',
      'get_client_data',
      'get_server_facts',
    ],
  },
  {
    id: 'agents',
    label: 'Agents',
    icon: Bot,
    jobTypes: ['deploy_agent', 'ping_agent'],
  },
]

// Fallback bucket icon for any job type the API returns that isn't listed in
// JOB_TYPE_CATEGORIES above, so the picker stays forward-compatible with new
// backend job types without requiring a frontend release first.
export const OTHER_CATEGORY_ICON = Shapes
