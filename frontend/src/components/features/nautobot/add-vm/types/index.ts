/**
 * Type definitions for nautobot-add-vm feature
 */

// ============================================================================
// Core Data Types
// ============================================================================

export interface DropdownOption {
  id: string
  name: string
  display?: string
}

export interface ClusterOption {
  id: string
  name: string
  cluster_group?: { id: string; name: string } | null
}

export interface SoftwareImageOption {
  id: string
  image_file_name: string
  software_version?: { id: string; version: string }
}

export interface SoftwareVersion {
  id: string
  version: string
  platform?: { id: string; name: string }
}

// ============================================================================
// Interface & Network Types
// ============================================================================

export interface InterfaceTypeOption {
  value: string
  display_name: string
}

export interface InterfaceData {
  id: string
  name: string
  type: string
  status: string
  ip_addresses: Array<{
    id: string
    address: string
    namespace: string
    ip_role: string
    is_primary?: boolean
  }>
  enabled?: boolean
  mgmt_only?: boolean
  description?: string
  mac_address?: string
  mtu?: number
  mode?: string
  untagged_vlan?: string
  tagged_vlans?: string[]
  parent_interface?: string
  bridge?: string
  lag?: string
  tags?: string[]
}

export interface VlanItem {
  id: string
  name: string
  description?: string
  vid: number
  role?: { id: string; name: string }
  location?: { id: string; name: string }
}

// ============================================================================
// Response Types for TanStack Query
// ============================================================================

export interface VMDropdownsResponse {
  roles: DropdownOption[]
  statuses: DropdownOption[]
  clusters: ClusterOption[]
  clusterGroups: DropdownOption[]
  platforms: DropdownOption[]
  namespaces: DropdownOption[]
  tags: DropdownOption[]
  interfaceTypes: InterfaceTypeOption[]
  interfaceStatuses: DropdownOption[]
  ipRoles: DropdownOption[]
}

// ============================================================================
// Form & Submission Types
// ============================================================================

export interface StatusMessage {
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

// ============================================================================
// Tags & Custom Fields
// ============================================================================

export interface TagItem {
  id: string
  name: string
  color?: string
}

export interface CustomField {
  id: string
  key: string
  label: string
  type: {
    value: string
  }
  required: boolean
  description?: string
}
