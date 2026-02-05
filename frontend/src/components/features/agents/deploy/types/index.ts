// Deploy configuration for Agents operations
export interface DeployConfig {
  deviceIds: string[]
  templateId: number
  variables: Record<string, string>
  repositoryId: number
  useNautobotContext: boolean
  path?: string
}

// Result of dry run (template rendering)
export interface DryRunResult {
  deviceId: string
  deviceName: string
  renderedConfig: string
  success: boolean
  error?: string
}

// Result of deploy/activate operations
export interface DeployResult {
  deviceId: string
  deviceName: string
  success: boolean
  gitCommitHash?: string
  activationStatus?: 'pending' | 'success' | 'failed'
  error?: string
}

// Summary statistics for deployment execution
export interface DeployExecutionSummary {
  total: number
  successful: number
  failed: number
}

// Re-export Git repository type
export type { GitRepository } from '@/types/git'
