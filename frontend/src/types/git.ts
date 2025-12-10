/**
 * Shared Git-related type definitions
 * Used across all Git compare components
 */

/**
 * Git Repository configuration
 */
export interface GitRepository {
  id: number
  name: string
  category: string
  url: string
  branch: string
  is_active: boolean
  description?: string
}

/**
 * File or directory item from Git repository
 */
export interface FileItem {
  name: string
  path: string
  size: number
  type: 'file' | 'directory'
}

/**
 * Git branch information
 */
export interface Branch {
  name: string
  current: boolean
}

/**
 * Git commit information
 */
export interface Commit {
  hash: string
  author: {
    name: string
    email: string
  }
  date: string
  message: string
  short_hash: string
  files_changed: number
}

/**
 * Git commit with file change type (for file history)
 */
export interface FileHistoryCommit extends Commit {
  change_type: string
}

/**
 * Individual line in a diff comparison
 */
export interface DiffLine {
  type: 'equal' | 'delete' | 'insert' | 'replace' | 'empty'
  line_number: number | null
  content: string
}

/**
 * Statistics about diff changes
 */
export interface DiffStats {
  additions: number
  deletions: number
  changes: number
  total_lines: number
}

/**
 * Result of comparing two commits or files
 */
export interface ComparisonResult {
  commit1: string
  commit2: string
  file_path: string
  diff_lines: string[]
  left_file: string
  right_file: string
  left_lines: DiffLine[]
  right_lines: DiffLine[]
  stats: DiffStats
}

/**
 * Repository response from API
 */
export interface RepositoriesResponse {
  repositories: GitRepository[]
}
