/**
 * Constants for nautobot-add-device feature
 * CRITICAL: These constants must be defined outside components to prevent re-render loops
 */

import type {
  DropdownOption,
  DeviceType,
  LocationItem,
  SoftwareVersion,
  Platform,
  InterfaceData,
} from './types'

// ============================================================================
// Empty Arrays (used as default parameters)
// ============================================================================

export const EMPTY_DROPDOWN_OPTIONS: DropdownOption[] = []
export const EMPTY_DEVICE_TYPES: DeviceType[] = []
export const EMPTY_LOCATIONS: LocationItem[] = []
export const EMPTY_SOFTWARE_VERSIONS: SoftwareVersion[] = []
export const EMPTY_PLATFORMS: Platform[] = []
export const EMPTY_INTERFACES: InterfaceData[] = []
export const EMPTY_STRING_ARRAY: string[] = []
export const EMPTY_OBJECT: Record<string, string> = {}

// ============================================================================
// Default Templates
// ============================================================================

/**
 * Default interface template
 * Used when creating new interfaces
 */
export const DEFAULT_INTERFACE: Omit<InterfaceData, 'id'> = {
  name: '',
  type: '',
  status: '',
  ip_address: '',
  namespace: '',
  enabled: true,
  mgmt_only: false,
  is_primary_ipv4: false,
} as const

// ============================================================================
// Dropdown Options
// ============================================================================

/**
 * Prefix length options for IP addresses
 */
export const PREFIX_LENGTH_OPTIONS = [
  '/8',
  '/16',
  '/24',
  '/25',
  '/26',
  '/27',
  '/28',
  '/29',
  '/30',
  '/31',
  '/32',
] as const

/**
 * VLAN mode options
 */
export const VLAN_MODES = [
  { value: 'none', label: 'None' },
  { value: 'access', label: 'Access' },
  { value: 'tagged', label: 'Tagged' },
  { value: 'tagged-all', label: 'Tagged All' },
] as const

// ============================================================================
// TanStack Query Configuration
// ============================================================================

/**
 * Stale times for different types of data
 * Used to configure TanStack Query cache behavior
 */
export const QUERY_STALE_TIMES = {
  STATIC: 5 * 60 * 1000, // 5 minutes for mostly static data (dropdowns, etc.)
  SEMI_STATIC: 2 * 60 * 1000, // 2 minutes for semi-static data (tags, custom fields)
  DYNAMIC: 30 * 1000, // 30 seconds for dynamic data (VLANs)
  REALTIME: 0, // No cache for real-time data
} as const
