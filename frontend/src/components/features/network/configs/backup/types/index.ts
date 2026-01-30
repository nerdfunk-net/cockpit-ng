export interface Device {
  id: string
  name: string
  primary_ip4?: { address: string }
  role?: { name: string }
  location?: { name: string }
  device_type?: { model: string }
  status?: { name: string }
  cf_last_backup?: string
}

export interface BackupHistoryEntry {
  id: string
  date: string
  size: string
  status: 'success' | 'failed' | 'in_progress'
  commit_hash?: string
  message?: string
}

export interface DeviceFilters {
  name?: string
  role?: string
  location?: string
  deviceType?: string
  status?: string
  lastBackupDate?: string
  dateComparison?: 'lte' | 'lt' | ''
}

export interface BackupPagination {
  limit: number
  offset: number
}

export interface BackupSorting {
  column?: string
  order: 'asc' | 'desc' | 'none'
}

export interface FilterOptions {
  roles: Set<string>
  locations: Set<string>
  deviceTypes: Set<string>
  statuses: Set<string>
}
