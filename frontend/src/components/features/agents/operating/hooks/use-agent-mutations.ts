import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { queryKeys } from '@/lib/query-keys'
import type { GitPullInput, DockerRestartInput, CommandResult } from '../types'

export function useAgentMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const gitPull = useMutation({
    mutationFn: async (input: GitPullInput): Promise<CommandResult> => {
      return apiCall<CommandResult>('cockpit-agent/git-pull', {
        method: 'POST',
        body: JSON.stringify({
          agent_id: input.agent_id,
          repository_path: input.repository_path,
          branch: input.branch || 'main',
        }),
      })
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cockpitAgents.history(variables.agent_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.cockpitAgents.list() })
      toast({
        title: 'Git Pull Completed',
        description: data.output || `Command executed in ${data.execution_time_ms}ms`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Git Pull Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const dockerRestart = useMutation({
    mutationFn: async (input: DockerRestartInput): Promise<CommandResult> => {
      return apiCall<CommandResult>('cockpit-agent/docker-restart', {
        method: 'POST',
        body: JSON.stringify({
          agent_id: input.agent_id,
          container_name: input.container_name,
        }),
      })
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cockpitAgents.history(variables.agent_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.cockpitAgents.list() })
      toast({
        title: 'Docker Restart Completed',
        description: data.output || `Container restarted in ${data.execution_time_ms}ms`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Docker Restart Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  return { gitPull, dockerRestart }
}
