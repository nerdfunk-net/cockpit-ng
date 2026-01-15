/**
 * Type definitions for the Config File Browser feature
 */

export interface GitTreeNode {
  name: string
  path: string
  type: 'directory'
  file_count?: number
  children?: GitTreeNode[]
  repository_name?: string
}

export interface FileWithCommit {
  name: string
  path: string
  size: number
  last_commit: {
    hash: string
    short_hash: string
    message: string
    author: { name: string; email: string }
    date: string
    timestamp: number
  }
}

export interface DirectoryFilesResponse {
  path: string
  files: FileWithCommit[]
  directory_exists: boolean
}

export interface GitCommitInfo {
  hash: string
  short_hash: string
  message: string
  author: { name: string; email: string }
  date: string
  change_type: 'A' | 'M' | 'D' | 'N'
}

export interface FileHistoryResponse {
  file_path: string
  from_commit: string
  total_commits: number
  commits: GitCommitInfo[]
}

export interface FileDiffLine {
  line_number: number
  content: string
  type: 'equal' | 'delete' | 'replace' | 'insert'
}

export interface FileDiffResponse {
  commit1: string
  commit2: string
  file_path: string
  left_file: string
  right_file: string
  left_lines: FileDiffLine[]
  right_lines: FileDiffLine[]
  stats: {
    additions: number
    deletions: number
    changes: number
    total_lines?: number
  }
}

export interface Repository {
  id: number
  name: string
  category: string
  description?: string
}
