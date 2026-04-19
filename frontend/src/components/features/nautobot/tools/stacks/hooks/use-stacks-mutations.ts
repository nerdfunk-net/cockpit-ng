import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { ProcessStacksResponse } from '../types/stacks-types'

interface ProcessStacksInput {
  device_ids: string[]
  separator?: string
}

export function useStacksMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const processStacks = useMutation<ProcessStacksResponse, Error, ProcessStacksInput>({
    mutationFn: (input) =>
      apiCall<ProcessStacksResponse>('nautobot/devices/stacks/process', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nautobot.stackDevices() })
      queryClient.invalidateQueries({ queryKey: queryKeys.nautobot.devices() })

      if (data.failed === 0) {
        toast({
          title: 'Stacks processed',
          description: `Successfully processed ${data.succeeded} device(s).`,
        })
      } else {
        toast({
          title: 'Partial success',
          description: `${data.succeeded} succeeded, ${data.failed} failed.`,
          variant: 'destructive',
        })
      }
    },
    onError: (error) => {
      toast({
        title: 'Processing failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  return { processStacks }
}
