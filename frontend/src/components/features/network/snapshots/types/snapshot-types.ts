/**
 * TypeScript types for network snapshots feature.
 */

export interface SnapshotCommand {
  id?: number
  template_id?: number
  command: string
  use_textfsm: boolean
  order: number
  created_at?: string
}

export interface SnapshotCommandTemplate {
  id: number
  name: string
  description: string | null
  scope: 'global' | 'private'
  created_by: string
  is_active: boolean
  created_at: string
  updated_at: string
  commands: SnapshotCommand[]
}

export interface SnapshotCommandTemplateCreate {
  name: string
  description?: string
  scope: 'global' | 'private'
  commands: Omit<SnapshotCommand, 'id' | 'template_id' | 'created_at'>[]
}

export interface SnapshotResult {
  id: number
  snapshot_id: number
  device_name: string
  device_ip: string | null
  status: 'pending' | 'running' | 'success' | 'failed'
  git_file_path: string | null
  git_commit_hash: string | null
  parsed_data: string | null // JSON string
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface Snapshot {
  id: number
  name: string
  description: string | null
  template_id: number | null
  template_name: string | null
  git_repository_id: number | null
  snapshot_path: string
  executed_by: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  device_count: number
  success_count: number
  failed_count: number
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  results?: SnapshotResult[]
}

export interface SnapshotListItem {
  id: number
  name: string
  description: string | null
  template_id: number | null
  template_name: string | null
  git_repository_id: number | null
  snapshot_path: string
  executed_by: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  device_count: number
  success_count: number
  failed_count: number
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface SnapshotExecuteRequest {
  template_id: number
  name: string
  description?: string
  git_repository_id: number
  snapshot_path: string
  devices: unknown[] // Device objects from Nautobot (can be DeviceInfo[] or any device structure)
}

export interface CommandDiff {
  command: string
  status: 'added' | 'removed' | 'modified' | 'unchanged'
  diff?: Record<string, unknown>
}

export interface DeviceComparisonResult {
  device_name: string
  status: 'same' | 'different' | 'missing_in_snapshot1' | 'missing_in_snapshot2'
  snapshot1_status: string | null
  snapshot2_status: string | null
  commands: CommandDiff[]
}

export interface SnapshotCompareRequest {
  snapshot_id_1: number
  snapshot_id_2: number
  device_filter?: string[]
}

export interface SnapshotCompareResponse {
  snapshot1: SnapshotListItem
  snapshot2: SnapshotListItem
  devices: DeviceComparisonResult[]
  summary: {
    total_devices: number
    same_count: number
    different_count: number
    missing_in_snapshot1: number
    missing_in_snapshot2: number
  }
}

export interface GitRepository {
  id: number
  name: string
  type: string
  url?: string
  local_path?: string
}
