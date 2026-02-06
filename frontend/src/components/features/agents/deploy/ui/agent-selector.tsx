import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
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
            <SelectItem key={agent.id} value={agent.id} className="cursor-pointer focus:bg-blue-50 focus:text-gray-900">
              <div className="flex flex-col">
                <span className="font-medium">{agent.name}</span>
                {agent.description && (
                  <span className="text-xs text-muted-foreground">{agent.description}</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
