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
}

// ============================================================================
// Form & Submission Types
// ============================================================================

export interface StatusMessage {
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}
