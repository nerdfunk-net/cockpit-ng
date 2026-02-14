export interface Agent {
  id: string
  agent_id?: string
  name: string
  description: string
  git_repository_id: number | null
}

export interface AgentsSettings {
  deployment_method: 'local' | 'sftp' | 'git'
  local_root_path: string
  sftp_hostname: string
  sftp_port: number
  sftp_path: string
  sftp_username: string
  sftp_password: string
  use_global_credentials: boolean
  global_credential_id: number | null
  git_repository_id: number | null
  agents: Agent[]
}

export interface GitRepository {
  id: number
  name: string
  url: string
  category: string
  branch: string
  last_sync: string | null
}

export interface AgentsResponse {
  success: boolean
  data?: AgentsSettings
  message?: string
}

export interface GitRepositoriesResponse {
  repositories: GitRepository[]
  total: number
}
