import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { FieldMapping } from './use-field-mapping-query'

interface SaveFieldMappingInput {
  appName: string
  mapping: FieldMapping
}

/**
 * Mutations for persisting a user's saved field mapping. Reusable across any
 * tool that adopts saved field-mapping preferences.
 */
export function useFieldMappingMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const saveFieldMapping = useMutation({
    mutationFn: ({ appName, mapping }: SaveFieldMappingInput) =>
      apiCall(`field-mappings/${appName}`, {
        method: 'PUT',
        body: JSON.stringify({ mapping }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.fieldMappings.detail(variables.appName),
      })
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save field mapping for later use',
        variant: 'destructive',
      })
    },
  })

  return { saveFieldMapping }
}
