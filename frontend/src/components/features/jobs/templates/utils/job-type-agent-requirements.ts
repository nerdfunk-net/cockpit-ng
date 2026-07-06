import type { AgentType } from '@/components/features/settings/connections/agents/types'

export interface JobTypeAgentRequirement {
  agentType: AgentType
  label: string
}

// Job types that only make sense once a matching agent has been configured
// under Settings → Agents. Used to gray out their picker cards when no
// agent of the required type exists yet.
export const JOB_TYPE_AGENT_REQUIREMENTS: Record<string, JobTypeAgentRequirement> = {
  port_scan: { agentType: 'nmap', label: 'Nmap' },
  get_open_ports: { agentType: 'ansible', label: 'Ansible' },
  get_server_facts: { agentType: 'ansible', label: 'Ansible' },
  deploy_agent: { agentType: 'git-based', label: 'Git-based' },
}
