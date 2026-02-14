'use client'

import { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Activity, RefreshCw, Server, Wifi, WifiOff, Loader2, BookOpen } from 'lucide-react'
import { useAgentsQuery } from './hooks/use-agents-query'
import { useAgentMutations } from './hooks/use-agent-mutations'
import { AgentsGrid } from './components/agents-grid'
import { DeployInstructions } from './components/deploy-instructions'
import { GitPullDialog } from './dialogs/git-pull-dialog'
import { DockerRestartDialog } from './dialogs/docker-restart-dialog'
import { CommandHistoryDialog } from './dialogs/command-history-dialog'
import { EMPTY_AGENTS } from './utils/constants'

export function AgentsOperatingPage() {
  const { data, isLoading, refetch, isFetching } = useAgentsQuery()
  const { gitPull, dockerRestart } = useAgentMutations()

  const agents = data?.agents ?? EMPTY_AGENTS

  // Dialog state
  const [gitPullAgent, setGitPullAgent] = useState<string | null>(null)
  const [dockerRestartAgent, setDockerRestartAgent] = useState<string | null>(null)
  const [historyAgent, setHistoryAgent] = useState<string | null>(null)

  // Summary stats
  const stats = useMemo(() => {
    const online = agents.filter((a) => a.status === 'online').length
    return { total: agents.length, online, offline: agents.length - online }
  }, [agents])

  // Handlers
  const handleGitPull = useCallback((agentId: string) => setGitPullAgent(agentId), [])
  const handleDockerRestart = useCallback((agentId: string) => setDockerRestartAgent(agentId), [])
  const handleViewHistory = useCallback((agentId: string) => setHistoryAgent(agentId), [])
  const handleRefresh = useCallback(() => refetch(), [refetch])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Activity className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Agents Operating</h1>
            <p className="text-muted-foreground mt-2">Monitor and manage running Cockpit agents</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
            {isFetching ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Server className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Agents</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Wifi className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.online}</p>
              <p className="text-xs text-muted-foreground">Online</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <WifiOff className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.offline}</p>
              <p className="text-xs text-muted-foreground">Offline</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Running Agents */}
      <Card className="shadow-lg border-0 overflow-hidden p-0">
        <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-t-lg m-0 py-2 px-4">
          <CardTitle className="flex items-center space-x-2 text-sm font-medium">
            <Activity className="h-5 w-5" />
            <span>Running Agents</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <AgentsGrid
              agents={agents}
              onGitPull={handleGitPull}
              onDockerRestart={handleDockerRestart}
              onViewHistory={handleViewHistory}
            />
          )}
        </CardContent>
      </Card>

      {/* Deployment Instructions */}
      <Card className="shadow-lg border-0 overflow-hidden p-0">
        <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-t-lg m-0 py-2 px-4">
          <CardTitle className="flex items-center space-x-2 text-sm font-medium">
            <BookOpen className="h-5 w-5" />
            <span>Deployment Instructions</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50">
          <DeployInstructions />
        </CardContent>
      </Card>

      {/* Dialogs */}
      {gitPullAgent && (
        <GitPullDialog
          open={!!gitPullAgent}
          onOpenChange={(open) => !open && setGitPullAgent(null)}
          agentId={gitPullAgent}
          mutation={gitPull}
        />
      )}
      {dockerRestartAgent && (
        <DockerRestartDialog
          open={!!dockerRestartAgent}
          onOpenChange={(open) => !open && setDockerRestartAgent(null)}
          agentId={dockerRestartAgent}
          mutation={dockerRestart}
        />
      )}
      {historyAgent && (
        <CommandHistoryDialog
          open={!!historyAgent}
          onOpenChange={(open) => !open && setHistoryAgent(null)}
          agentId={historyAgent}
        />
      )}
    </div>
  )
}
