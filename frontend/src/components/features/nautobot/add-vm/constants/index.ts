/**
 * Constants for nautobot-add-vm feature
 * CRITICAL: These constants must be defined outside components to prevent re-render loops
 */

import type {
  DropdownOption,
  ClusterOption,
  SoftwareImageOption,
  SoftwareVersion,
} from '../types'

// ============================================================================
// Empty Arrays (used as default parameters)
// ============================================================================

export const EMPTY_DROPDOWN_OPTIONS: DropdownOption[] = []
export const EMPTY_CLUSTERS: ClusterOption[] = []
export const EMPTY_SOFTWARE_IMAGES: SoftwareImageOption[] = []
export const EMPTY_SOFTWARE_VERSIONS: SoftwareVersion[] = []
export const EMPTY_STRING_ARRAY: string[] = []

// ============================================================================
// TanStack Query Configuration
// ============================================================================

export const QUERY_STALE_TIMES = {
  STATIC: 5 * 60 * 1000, // 5 minutes for mostly static data (dropdowns, etc.)
  SEMI_STATIC: 2 * 60 * 1000, // 2 minutes for semi-static data (tags)
  DYNAMIC: 30 * 1000, // 30 seconds for dynamic data
  REALTIME: 0, // No cache for real-time data
} as const
