export interface SnmpMapping {
  content: string
  filename: string
  last_modified?: string
}

export interface ValidationError {
  message: string
  error?: string
  line?: number
  column?: number
}

export interface ValidationResponse {
  success: boolean
  valid: boolean
  message?: string
  error?: string
  line?: number
  column?: number
}

export interface SaveResponse {
  success: boolean
  message?: string
}

export interface LoadResponse {
  success: boolean
  data?: string
}

export interface GitRepository {
  id: number
  name: string
  category: string
  is_active: boolean
  last_sync?: string | null
}

export interface GitFile {
  name: string
  path: string
  directory: string
}

export interface GitRepoStatus {
  ahead_count: number
  behind_count: number
  is_clean: boolean
  is_synced?: boolean
}

export interface GitImportFormData {
  repositoryId: number
  filePath: string
}

export type ImportStep = 'select-repo' | 'check-sync' | 'select-file'
