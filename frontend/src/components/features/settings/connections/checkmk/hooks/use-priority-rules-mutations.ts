import { useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type {
  CheckMKPriorityRule,
  ExpressionItem,
} from '../types'

interface CreateRuleInput {
  priority_order: number
  filename: string
  expression: ExpressionItem[]
}

interface UpdateRuleInput {
  id: number
  filename?: string
  expression?: ExpressionItem[]
}

export function usePriorityRulesMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const createRule = useMutation({
    mutationFn: async (data: CreateRuleInput) => {
      const result = await apiCall<CheckMKPriorityRule>('checkmk/priority-rules', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.checkmkPriorityRules.list(),
      })
      toast({ title: 'Rule created', description: 'Priority rule added.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const updateRule = useMutation({
    mutationFn: async ({ id, ...data }: UpdateRuleInput) => {
      const result = await apiCall<CheckMKPriorityRule>(
        `checkmk/priority-rules/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify(data),
        }
      )
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.checkmkPriorityRules.list(),
      })
      toast({ title: 'Rule updated', description: 'Priority rule saved.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const deleteRule = useMutation({
    mutationFn: async (id: number) => {
      await apiCall(`checkmk/priority-rules/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.checkmkPriorityRules.list(),
      })
      toast({ title: 'Rule deleted', description: 'Priority rule removed.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const reorderRules = useMutation({
    mutationFn: async (ruleIds: number[]) => {
      const result = await apiCall<CheckMKPriorityRule[]>(
        'checkmk/priority-rules/reorder',
        {
          method: 'PUT',
          body: JSON.stringify({ rule_ids: ruleIds }),
        }
      )
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.checkmkPriorityRules.list(),
      })
      toast({ title: 'Priority order saved', description: 'New order persisted.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  return useMemo(
    () => ({ createRule, updateRule, deleteRule, reorderRules }),
    [createRule, updateRule, deleteRule, reorderRules]
  )
}
