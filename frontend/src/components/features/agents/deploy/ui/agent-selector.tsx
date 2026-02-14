import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import type { Agent } from '../hooks/use-agent-selector'

interface AgentSelectorProps {
  agents: Agent[]
  selectedAgentId: string | null
  onChange: (agentId: string) => void
  loading?: boolean
}

export function AgentSelector({
  agents,
  selectedAgentId,
  onChange,
  loading = false
}: AgentSelectorProps) {
  if (loading) {
    return <Skeleton className="h-10 w-full" />
  }

  if (agents.length === 0) {
    return (
      <div className="space-y-2">
        <Label>Agent</Label>
        <div className="p-3 border rounded-md bg-yellow-50 text-yellow-800 text-sm">
          No agents configured. Please configure agents in Settings → Connections → Agents first.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="agent">Agent</Label>
      <Select
        value={selectedAgentId || ''}
        onValueChange={onChange}
      >
        <SelectTrigger id="agent">
          <SelectValue placeholder="Select an agent" />
        </SelectTrigger>
        <SelectContent>
          {agents.map((agent) => (
            <SelectItem 
              key={agent.id} 
              value={agent.agent_id || ''} 
              disabled={!agent.agent_id}
              className="cursor-pointer focus:bg-blue-50 focus:text-gray-900"
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{agent.name}</span>
                  {!agent.agent_id && (
                    <Badge variant="destructive" className="text-xs">No Agent ID</Badge>
                  )}
                </div>
                {agent.description && (
                  <span className="text-xs text-muted-foreground">{agent.description}</span>
                )}
                {agent.agent_id && (
                  <span className="text-xs text-muted-foreground font-mono">ID: {agent.agent_id}</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {agents.length > 0 && agents.every(a => !a.agent_id) && (
        <div className="p-3 border rounded-md bg-amber-50 border-amber-200 text-amber-800 text-sm">
          <strong>Warning:</strong> No agents have an Agent ID configured. Please edit agents in Settings → Connections → Agents to add Agent IDs.
        </div>
      )}
    </div>
  )
}
