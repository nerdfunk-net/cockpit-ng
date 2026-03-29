// Git Repository Management Types

export interface GitRepository {
  id: number
  name: string
  category: string
  url: string
  branch: string
  auth_type?: string
  credential_name?: string
  path?: string
  verify_ssl: boolean
  git_author_name?: string
  git_author_email?: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
  last_sync?: string
  sync_status?: string
}

export interface GitCredential {
  id?: number
  name: string
  username: string
  type: string
  source?: string
}

export interface GitStatus {
  repository_name: string
  repository_url: string
  repository_branch: string
  sync_status: string
  exists: boolean
  is_git_repo: boolean
  is_synced: boolean
  behind_count: number
  current_branch?: string
  modified_files?: string[]
  untracked_files?: string[]
  staged_files?: string[]
  commits?: GitCommit[]
  branches?: string[]
}

export interface GitCommit {
  hash: string
  message: string
  author: {
    name: string
    email: string
  }
  date: string
}

export interface GitFormData {
  name: string
  category: string
  url: string
  branch: string
  auth_type: string
  credential_name: string
  path: string
  verify_ssl: boolean
  git_author_name: string
  git_author_email: string
  description: string
}

export interface DebugResult {
  success: boolean
  message?: string
  error?: string
  error_type?: string
  details?: Record<string, unknown>
  diagnostics?: DebugDiagnostics
}

export interface DebugDiagnostics {
  repository_info: Record<string, unknown>
  access_test: Record<string, unknown>
  file_system: Record<string, unknown>
  git_status: Record<string, unknown>
  ssl_info: Record<string, unknown>
  credentials: Record<string, unknown>
  push_capability?: {
    status: string
    message: string
    can_push: boolean
    has_credentials: boolean
    has_remote: boolean
  }
}

export interface ConnectionTestRequest {
  url: string
  branch: string
  auth_type: string
  credential_name: string | null
  verify_ssl: boolean
}

export interface ConnectionTestResponse {
  success: boolean
  message: string
}

// Form submission types
export interface RepositoryCreateData extends GitFormData {
  is_active?: boolean
}

export interface RepositoryUpdateData extends GitFormData {
  is_active: boolean
}

// Debug operation type
export type DebugOperation = 'read' | 'write' | 'delete' | 'push' | 'diagnostics'
