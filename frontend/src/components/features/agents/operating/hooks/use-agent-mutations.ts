import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { queryKeys } from '@/lib/query-keys'
import type {
  GitPullInput,
  DockerRestartInput,
  CommandResult,
  PingInput,
  PingCommandResult,
} from '../types'

export function useAgentMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const gitPull = useMutation({
    mutationFn: async (input: GitPullInput): Promise<CommandResult> => {
      return apiCall<CommandResult>(`cockpit-agent/${input.agent_id}/git-pull`, {
        method: 'POST',
      })
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.cockpitAgents.history(variables.agent_id),
      })
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
      return apiCall<CommandResult>(`cockpit-agent/${input.agent_id}/docker-restart`, {
        method: 'POST',
      })
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.cockpitAgents.history(variables.agent_id),
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.cockpitAgents.list() })
      toast({
        title: 'Docker Restart Completed',
        description:
          data.output || `Container restarted in ${data.execution_time_ms}ms`,
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

  const ping = useMutation({
    mutationFn: async (input: PingInput): Promise<PingCommandResult> => {
      return apiCall<PingCommandResult>(`cockpit-agent/${input.agent_id}/ping`, {
        method: 'POST',
        body: JSON.stringify({ inventory_id: input.inventory_id }),
      })
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.cockpitAgents.history(variables.agent_id),
      })
      const output = data.output
      const summary = output
        ? `${output.reachable_count} reachable, ${output.unreachable_count} unreachable`
        : `Completed in ${data.execution_time_ms}ms`
      toast({ title: 'Ping Completed', description: summary })
    },
    onError: (error: Error) => {
      toast({
        title: 'Ping Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  return { gitPull, dockerRestart, ping }
}
