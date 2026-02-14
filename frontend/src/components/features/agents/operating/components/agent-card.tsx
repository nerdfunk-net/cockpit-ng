'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GitBranch, RotateCcw, History, Clock, Terminal, Server } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelativeTime, formatUptime, parseCapabilities } from '../utils/format-utils'
import type { CockpitAgent } from '../types'

interface AgentCardProps {
  agent: CockpitAgent
  onGitPull: (agentId: string) => void
  onDockerRestart: (agentId: string) => void
  onViewHistory: (agentId: string) => void
}

export function AgentCard({ agent, onGitPull, onDockerRestart, onViewHistory }: AgentCardProps) {
  const isOnline = agent.status === 'online'
  const capabilities = parseCapabilities(agent.capabilities)

  return (
    <Card
      className={cn(
        'transition-all duration-200 hover:shadow-md',
        isOnline ? 'border-green-200' : 'border-red-200'
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">{agent.hostname}</span>
          </div>
          <Badge
            variant={isOnline ? 'default' : 'destructive'}
            className={cn(
              'text-xs',
              isOnline && 'bg-green-100 text-green-700 hover:bg-green-100'
            )}
          >
            {agent.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Agent info */}
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="font-medium">Version:</span>
            <span>{agent.version}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{formatRelativeTime(agent.last_heartbeat)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">Uptime:</span>
            <span>{formatUptime(agent.started_at)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Terminal className="h-3 w-3" />
            <span>{agent.commands_executed} cmds</span>
          </div>
        </div>

        {/* Capabilities */}
        {capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {capabilities.map((cap) => (
              <Badge key={cap} variant="outline" className="text-[10px] px-1.5 py-0">
                {cap}
              </Badge>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-8"
            disabled={!isOnline}
            onClick={() => onGitPull(agent.agent_id)}
          >
            <GitBranch className="h-3 w-3 mr-1" />
            Git Pull
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-8"
            disabled={!isOnline}
            onClick={() => onDockerRestart(agent.agent_id)}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Restart
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8"
            onClick={() => onViewHistory(agent.agent_id)}
          >
            <History className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
