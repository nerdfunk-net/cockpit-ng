export interface CockpitAgent {
  agent_id: string
  status: string // 'online' | 'offline'
  last_heartbeat: number // unix timestamp
  version: string
  hostname: string
  capabilities: string // comma-separated
  started_at: number // unix timestamp
  commands_executed: number
}

export interface AgentListResponse {
  agents: CockpitAgent[]
}

export interface CommandHistoryItem {
  id: number
  agent_id: string
  command_id: string
  command: string
  params: string | null // JSON string
  status: string | null
  output: string | null
  error: string | null
  execution_time_ms: number | null
  sent_at: string // ISO datetime
  completed_at: string | null // ISO datetime
  sent_by: string | null
}

export interface CommandHistoryResponse {
  commands: CommandHistoryItem[]
  total: number
}

export interface GitPullInput {
  agent_id: string
  repository_path: string
  branch?: string
}

export interface DockerRestartInput {
  agent_id: string
  container_name: string
}

export interface CommandResult {
  command_id: string
  status: string
  output: string | null
  error: string | null
  execution_time_ms: number
}
