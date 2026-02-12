/**
 * Constants for nautobot-add-vm feature
 * CRITICAL: These constants must be defined outside components to prevent re-render loops
 */

import type {
  DropdownOption,
  ClusterOption,
  SoftwareImageOption,
  SoftwareVersion,
  InterfaceTypeOption,
  InterfaceData,
  VlanItem,
} from '../types'

// ============================================================================
// Empty Arrays (used as default parameters)
// ============================================================================

export const EMPTY_DROPDOWN_OPTIONS: DropdownOption[] = []
export const EMPTY_CLUSTERS: ClusterOption[] = []
export const EMPTY_SOFTWARE_IMAGES: SoftwareImageOption[] = []
export const EMPTY_SOFTWARE_VERSIONS: SoftwareVersion[] = []
export const EMPTY_STRING_ARRAY: string[] = []
export const EMPTY_OBJECT: Record<string, string> = {}
export const EMPTY_INTERFACE_TYPES: InterfaceTypeOption[] = []
export const EMPTY_INTERFACES: InterfaceData[] = []
export const EMPTY_VLANS: VlanItem[] = []

// ============================================================================
// Default Templates
// ============================================================================

export const DEFAULT_IP_ADDRESS = {
  address: '',
  namespace: '',
  ip_role: 'none',
  is_primary: false,
}

export const DEFAULT_INTERFACE: Omit<InterfaceData, 'id'> = {
  name: '',
  type: '',
  status: '',
  ip_addresses: [],
  enabled: true,
  mgmt_only: false,
} as const

// ============================================================================
// Dropdown Options
// ============================================================================

export const VLAN_MODES = [
  { value: 'none', label: 'None' },
  { value: 'access', label: 'Access' },
  { value: 'tagged', label: 'Tagged' },
  { value: 'tagged-all', label: 'Tagged All' },
] as const

// ============================================================================
// TanStack Query Configuration
// ============================================================================

export const QUERY_STALE_TIMES = {
  STATIC: 5 * 60 * 1000, // 5 minutes for mostly static data (dropdowns, etc.)
  SEMI_STATIC: 2 * 60 * 1000, // 2 minutes for semi-static data (tags)
  DYNAMIC: 30 * 1000, // 30 seconds for dynamic data (VLANs)
  REALTIME: 0, // No cache for real-time data
} as const
